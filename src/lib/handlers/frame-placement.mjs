/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/frame-placement.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T19:32:54-08:00 (1794367974)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Placing stack frames on the module calls they belong to, shared by both context managers.
 *
 * @description
 * The live context manager tells overlapping calls apart by the frames on the stack, and both managers
 * use the same placement to find who supplied the code that is running when a leaf runs code it was handed
 * (#597). A frame is placed by its location, never by its function name alone: a suspended call's own file,
 * an instance's tagged or CommonJS code reached through its import graph, or a module's root folder.
 *
 * @module @cldmv/slothlet/handlers/frame-placement
 * @internal
 */
import { isNode, util } from "@cldmv/slothlet/helpers/platform";
import {
	instanceCommonJSFiles,
	instanceCommonJSVersion,
	instanceImporters,
	loadedScriptLookup,
	loadedScriptText,
	packageImporters,
	rememberNewest,
	scriptKeyInstance,
	setScriptKey,
	LOADED_BY_SPECIFIER,
	VITE_HOST_SCRIPTS,
	VITE_LOADED_BY
} from "@cldmv/slothlet/helpers/instance-imports";
import { ceilingMembers, combineCeilings, genuineWrappers, implWrappers } from "#handlers/trusted-root";
import { Reflect, Objects, Arrays, JSON, functionSource } from "@cldmv/slothlet/helpers/intrinsics";
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * The `Error` constructor as it was at module load, before any leaf could run.
 *
 * Caller identity is read off a stack, so a leaf that can influence how stacks are produced can
 * influence who it appears to be. Capturing the constructor here means a later reassignment of the
 * global `Error` cannot redirect the capture.
 * @type {ErrorConstructor}
 * @private
 */
const PristineError = Error;

/**
 * The Node built-ins the attribution path reads, captured at module load like {@link PristineError} (#714): the `fs`
 * and `crypto` functions (taken off their module objects, which code can reassign), the methods of the hash objects
 * `createHash` returns, `TextDecoder`, `JSON.parse`, the `Map` and `Set` iterators and `URLSearchParams`. Attribution
 * calls them through these references, so what replaces `process.getBuiltinModule`, a function on `fs` or `crypto`,
 * `Map.prototype.forEach`, `URLSearchParams` or the like after slothlet loads does not change what a frame is
 * attributed as.
 * @private
 */
const NODE_FS = isNode ? globalThis.process.getBuiltinModule("node:fs") : null;
const NODE_CRYPTO = isNode ? globalThis.process.getBuiltinModule("node:crypto") : null;
const FS_READ_FILE = NODE_FS?.readFileSync;
const FS_STAT = NODE_FS?.statSync;
const FS_EXISTS = NODE_FS?.existsSync;
const FS_REALPATH = NODE_FS?.realpathSync;
const CRYPTO_CREATE_HASH = NODE_CRYPTO?.createHash;
const HASH_PROTOTYPE = NODE_CRYPTO ? Objects.getPrototypeOf(Reflect.apply(CRYPTO_CREATE_HASH, NODE_CRYPTO, ["sha256"])) : null;
const HASH_UPDATE = HASH_PROTOTYPE?.update;
const HASH_DIGEST = HASH_PROTOTYPE?.digest;
const CapturedTextDecoder = TextDecoder;
const TEXT_DECODE = TextDecoder.prototype.decode;
const JSON_PARSE = JSON.parse;
const MAP_FOREACH = Map.prototype.forEach;
const SET_FOREACH = Set.prototype.forEach;
const CapturedURLSearchParams = URLSearchParams;
const CapturedURLSearchParamsGet = URLSearchParams.prototype.get;

/**
 * Call one of the captured `fs` functions.
 * @param {Function} fn - The captured function.
 * @param {...unknown} args - Its arguments.
 * @returns {unknown} What it returns.
 * @private
 */
function nodeFs(fn, ...args) {
	return Reflect.apply(fn, NODE_FS, args);
}

/**
 * The SHA-256 of some data, hex-encoded, through the captured `crypto` functions.
 * @param {string|Uint8Array} data - The data.
 * @param {string} [encoding] - The string's encoding.
 * @returns {string} The hash.
 * @private
 */
function sha256(data, encoding) {
	const hash = Reflect.apply(CRYPTO_CREATE_HASH, NODE_CRYPTO, ["sha256"]);
	Reflect.apply(HASH_UPDATE, hash, encoding === undefined ? [data] : [data, encoding]);
	return Reflect.apply(HASH_DIGEST, hash, ["hex"]);
}

/**
 * Every value of a `Map` through the captured iterator, an empty array when it is not a genuine `Map`.
 * @param {unknown} map - A candidate map.
 * @returns {Array<unknown>} The values.
 * @private
 */
function mapValues(map) {
	const values = [];
	try {
		Reflect.apply(MAP_FOREACH, map, [(value) => values.push(value)]);
	} catch {
		return [];
	}
	return values;
}

/**
 * Every member of a `Set` through the captured iterator, an empty array when it is not a genuine `Set`.
 * @param {unknown} set - A candidate set.
 * @returns {Array<unknown>} The members.
 * @private
 */
function setMembers(set) {
	const members = [];
	try {
		Reflect.apply(SET_FOREACH, set, [(member) => members.push(member)]);
	} catch {
		return [];
	}
	return members;
}

/**
 * One query parameter of a URL/id through a genuine `URLSearchParams`, null when absent.
 * @param {string} query - The query string (no leading `?`).
 * @param {string} name - The parameter name.
 * @returns {string|null} The value, or null.
 * @private
 */
function queryParam(query, name) {
	try {
		return Reflect.apply(CapturedURLSearchParamsGet, new CapturedURLSearchParams(query), [name]);
	} catch {
		return null;
	}
}

/**
 * Escape a literal for embedding in a RegExp.
 *
 * Function names reach the matcher from api paths, which are sanitised identifiers — but the
 * escape keeps a surprising name from being read as pattern syntax rather than text.
 *
 * @param {string} literal - Text to match literally.
 * @returns {string} Escaped source.
 * @private
 */
const escapeForRegExp = (literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Reduce a source location — a filesystem path or a URL — to a form two spellings of the same file
 * compare equal in.
 *
 * A stack frame names a module by URL (`file:///…/x.mjs?slothlet_instance=…`, percent-encoded),
 * while a wrapper records its file and a module its root folder as whatever the loader was handed —
 * usually a plain path. The scheme, query, hash and percent-encoding are dropped from a URL,
 * separators are made forward slashes, and a trailing slash is removed, so a root compares as a
 * prefix of the files inside it.
 *
 * @param {string} value - A path or URL.
 * @returns {string} The comparable form.
 * @internal
 *
 * @example
 * toComparablePath("file:///srv/app/api/x.mjs?slothlet_instance=a"); // "/srv/app/api/x.mjs"
 * toComparablePath("C:\\app\\api\\"); // "C:/app/api"
 */
export function toComparablePath(value) {
	// Some loaders (vitest's module runner among them) report a module by bare path with the loader's
	// cache-busting query still attached, so a query is dropped from a plain path as well.
	let text = String(value).replace(/\\/g, "/");
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
		text = text.replace(/[?#].*$/, "");
		try {
			text = decodeURIComponent(text);
		} catch {
			// A malformed escape cannot name a real file differently than it is spelled; compare it raw.
		}
		text = text.replace(/^file:\/\//i, "");
		// `file:///C:/x` → `C:/x`, the spelling a Windows path takes once its separators are normalised.
		if (/^\/[a-z]:\//i.test(text)) text = text.slice(1);
	} else {
		text = text.replace(/\?.*$/, "");
	}
	return text.replace(/\/+$/, "");
}

/**
 * The locations a suspended call's module was imported from, in the comparable form a stack frame's
 * location is reduced to (#601): a browser resolver's URL, or a TypeScript leaf's compiled copy.
 *
 * @param {object|null} wrapper - The wrapper being called.
 * @param {string|null} filePath - Its file.
 * @returns {Set<string>|null} Comparable locations, or null when none were recorded.
 * @private
 */
export function runtime_importedLocations(wrapper, filePath) {
	if (!filePath) return null;
	const recorded = wrapper?.slothlet?.processors?.loader?.importedLocationsFor?.(filePath, wrapper?.____slothletInternal?.moduleID);
	if (!recorded?.size) return null;
	return new Set([...recorded].map(toComparablePath));
}

/**
 * Real paths already resolved, by the path they were asked for.
 * @type {Map<string, string|null>}
 * @private
 */
const REAL_PATHS = new Map();

/**
 * The comparable form of a file's real path, when it differs from the path given (#601 review).
 *
 * Node reports a module in a stack frame by its real path, symlinks resolved, while slothlet records
 * the path it scanned. A base reached through a symlink (a package in a pnpm `node_modules`, a linked
 * workspace) therefore names every one of its files differently in a frame. Resolved once per path;
 * outside Node, or for a path that does not resolve, there is nothing to add.
 *
 * @param {string|null} filePath - A scanned path.
 * @returns {string|null} The real path's comparable form, or null when it is the same or unknown.
 * @private
 */
export function runtime_realComparablePath(filePath) {
	if (!filePath) return null;
	let real = REAL_PATHS.get(filePath);
	if (real === undefined) {
		real = null;
		try {
			const resolved = FS_REALPATH ? nodeFs(FS_REALPATH, filePath) : null;
			if (resolved && toComparablePath(resolved) !== toComparablePath(filePath)) real = toComparablePath(resolved);
		} catch {
			// A path that does not resolve (a synthetic or browser path) has no other spelling.
		}
		REAL_PATHS.set(filePath, real);
	}
	return real;
}

/**
 * The names a suspended call's entry function can appear under in a stack frame.
 * @param {string} apiPath - The call's api path.
 * @param {object|null} currentWrapper - The wrapper entered.
 * @returns {string[]} Its api key, and the function's own name when that is another.
 * @private
 */
export function runtime_entryNames(apiPath, currentWrapper) {
	const names = new Set([apiPath.slice(apiPath.lastIndexOf(".") + 1)]);
	const impl = currentWrapper?.____slothletInternal?.impl;
	if (typeof impl === "function" && typeof impl.name === "string" && impl.name && impl.name !== "anonymous") names.add(impl.name);
	return [...names].filter(Boolean);
}

/**
 * An instance's import graph in comparable form: for each file of the instance's own code, the files that
 * import it. Rebuilt only when the instance's graph has grown since it was last read.
 * @param {string} family - The instance ID.
 * @returns {Map<string, Set<string>>} Importers by imported file.
 * @private
 */
function runtime_importGraph(family) {
	return runtime_importGraphEntry(family).graph;
}

/**
 * An instance's comparable import graph and the set of every file in it, rebuilt only when the instance's
 * graph has gained an edge since it was last read.
 * @param {string} family - The instance ID.
 * @returns {{edges: number, graph: Map<string, Set<string>>, files: Set<string>}} The graph and its files.
 * @private
 */
function runtime_importGraphEntry(family) {
	const source = instanceImporters(family);
	if (!source) return EMPTY_GRAPH;
	const edges = source.edges ?? 0;
	const cached = IMPORT_GRAPHS.get(source);
	if (cached && cached.edges === edges) return cached;
	const graph = new Map();
	const files = new Set();
	for (const [file, importers] of source) {
		const location = toComparablePath(file);
		if (!graph.has(location)) graph.set(location, new Set());
		files.add(location);
		for (const importer of importers) {
			const from = toComparablePath(importer);
			graph.get(location).add(from);
			files.add(from);
		}
	}
	const entry = { edges, graph, files };
	IMPORT_GRAPHS.set(source, entry);
	return entry;
}

/**
 * Comparable import graphs by the instance graph they were built from.
 * @type {WeakMap<Map<string, Set<string>>, {edges: number, graph: Map<string, Set<string>>, files: Set<string>}>}
 * @private
 */
const IMPORT_GRAPHS = new WeakMap();

/**
 * The graph of an instance with no recorded imports.
 * @type {{edges: number, graph: Map<string, Set<string>>, files: Set<string>}}
 * @private
 */
const EMPTY_GRAPH = { edges: 0, graph: new Map(), files: new Set() };

/**
 * Each api cache's module roots, with the cache version they were built at.
 * @type {WeakMap<object, {version: number, roots: Array<{moduleID: string, root: string}>}>}
 * @private
 */
const MODULE_ROOTS = new WeakMap();

/**
 * One instance's module roots, longest first, rebuilt only when its cached modules change.
 * @param {object} cache - The instance's api cache manager.
 * @returns {Array<{moduleID: string, root: string}>} Module roots.
 * @private
 */
function runtime_moduleRoots(cache) {
	const cached = MODULE_ROOTS.get(cache);
	if (cached && cached.version === cache.version) return cached.roots;
	const roots = [];
	for (const moduleID of cache.getAllModuleIDs()) {
		const { folderPath } = cache.get(moduleID);
		// No base directory (`base: null`) and in-memory modules have no folder to own files by.
		if (typeof folderPath !== "string" || folderPath.startsWith("synthetic:")) continue;
		roots.push({ moduleID, root: toComparablePath(folderPath) });
		// A root reached through a symlink: frames name its files by their real path.
		const realRoot = runtime_realComparablePath(folderPath);
		if (realRoot) roots.push({ moduleID, root: realRoot });
	}
	// An empty root (a module mounted from `/`) would own every absolute path; it owns nothing.
	const sorted = roots.filter(({ root }) => root).sort((a, b) => b.root.length - a.root.length);
	MODULE_ROOTS.set(cache, { version: cache.version, roots: sorted });
	return sorted;
}

/**
 * Comparable locations of each instance's CommonJS files, by the object its CommonJS state lives in, so an
 * entry goes once the instance is released; with the file count they were built at.
 * @type {WeakMap<object, {count: number, locations: Set<string>}>}
 * @private
 */
const COMMONJS_LOCATIONS = new WeakMap();

/**
 * The comparable locations of an instance's CommonJS files — each by its path and its real path — rebuilt
 * only when the instance has more of them.
 * @param {string} family - The instance ID.
 * @returns {Set<string>} Comparable locations.
 * @private
 */
function runtime_commonJSLocations(family) {
	const version = instanceCommonJSVersion(family);
	if (!version) return NO_LOCATIONS;
	const cached = COMMONJS_LOCATIONS.get(version.key);
	if (cached && cached.count === version.count) return cached.locations;
	const locations = new Set();
	for (const file of instanceCommonJSFiles(family)) {
		locations.add(toComparablePath(file));
		const real = runtime_realComparablePath(file);
		if (real) locations.add(real);
	}
	COMMONJS_LOCATIONS.set(version.key, { count: version.count, locations });
	return locations;
}

/**
 * The locations of an instance with no CommonJS files.
 * @type {Set<string>}
 * @private
 */
const NO_LOCATIONS = new Set();

/**
 * Comparable forms of a loader's imported locations, by the list they were built from.
 * @type {WeakMap<Array<string>, Set<string>>}
 * @private
 */
const LOADED_LOCATIONS = new WeakMap();

/**
 * The comparable locations a loader imported its leaves from, rebuilt only when it recorded another.
 * @param {object} loader - An instance's loader.
 * @returns {Set<string>} Comparable locations.
 * @private
 */
function runtime_loadedLocations(loader) {
	const list = loader.importedLocations?.() ?? [];
	let set = LOADED_LOCATIONS.get(list);
	if (!set) {
		set = new Set(list.map(toComparablePath));
		LOADED_LOCATIONS.set(list, set);
	}
	return set;
}

/**
 * Whether a stack frame's function text names a suspended call's entry function. Only the text before
 * the location is searched, so a name inside the path cannot match by accident.
 * @param {string} head - The frame's text before its location.
 * @param {{fnNames?: string[], fnName?: string}} entry - A suspended call.
 * @returns {boolean} True when the frame is that function.
 * @private
 */
export function runtime_namesEntry(head, entry) {
	if (!head) return false;
	// Compiled on first use and kept on the entry: one pattern for all its names, not one per frame read.
	if (entry.namePattern === undefined) {
		const names = entry.fnNames ?? (entry.fnName ? [entry.fnName] : []);
		entry.namePattern = names.length ? new RegExp(`(?:^|[\\s.])(?:${names.map(escapeForRegExp).join("|")})(?=\\s|$|\\[)`) : null;
	}
	return entry.namePattern !== null && entry.namePattern.test(head.trim() + " ");
}

/**
 * The instance whose import tag a stack line carries: every file slothlet imports for an instance — a
 * leaf, and each helper it imports — is loaded under `?slothlet_instance=<id>`, and host code never is.
 * @param {string} line - One stack line.
 * @returns {string|null} The instance ID, or null.
 * @private
 */
function runtime_frameInstanceTag(line) {
	return /[?&]slothlet_instance=([^&#:)\s]+)/.exec(line)?.[1] ?? null;
}

/**
 * The mount whose copy of a leaf a stack line runs: each `api.slothlet.api.add()` mount imports its own copy
 * of a leaf under `&module=<moduleID>` (helpers stay one copy per instance, so they carry none).
 * @param {string} line - One stack line.
 * @returns {string|null} The mount's moduleID, or null.
 * @private
 */
function runtime_frameModuleTag(line) {
	// The loader writes the moduleID encoded (the Node loader with encodeURIComponent, the browser one through
	// URLSearchParams, which writes a space as `+`), so the raw tag holds none of the characters that end it here.
	const tag = /[?&]module=([^&#:)\s]+)/.exec(line)?.[1];
	if (!tag) return null;
	const spaced = tag.replace(/\+/g, " ");
	try {
		return decodeURIComponent(spaced);
	} catch {
		// A malformed escape cannot name a moduleID other than as spelled.
		return spaced;
	}
}

/**
 * Read the current call stack as frames, innermost first: each frame's function text, its location in
 * comparable form, and the raw text to look for an instance's import tag in.
 *
 * On V8 (Node, Chromium) the engine hands over structured call sites, which skips formatting and
 * re-parsing every frame as text: the capture runs on every identity read while a call is suspended, so
 * that cost is paid per api call and per promise reaction. Elsewhere the formatted trace is parsed.
 *
 * The frame budget is set for this capture only: the caller's frame sits below slothlet's own wrapper
 * frames, and the default of 10 can cut it off in a deep chain. The trace reports whether the budget cut it
 * short, so a reader that found nothing can look deeper. `prepareStackTrace` is set by this
 * capture for its duration as well. It is a writable global hook, so a leaf can install one that returns
 * an empty or forged trace — which would blank the frames this resolver matches on, and a caller that
 * cannot be attributed would otherwise be let through as though it were the host. Using the `Error`
 * captured at load and a formatter of slothlet's own keeps the capture out of a leaf's reach. Both
 * globals are restored immediately, so a legitimate consumer's formatter is unaffected.
 *
 * @param {number} limit - The most frames to capture.
 * @returns {Iterable<{head: string, path: string, line: string, async: boolean, evaluated: boolean, hash: string|null, key: string|null, enter: "leaf"|"call"|null, gap: boolean}> & {truncated: boolean, trailingGap: boolean}} The frames.
 * @private
 */
export function runtime_captureFrames(limit) {
	const previousLimit = PristineError.stackTraceLimit;
	const previousPrepare = PristineError.prepareStackTrace;
	PristineError.stackTraceLimit = limit;
	PristineError.prepareStackTrace = runtime_structuredFrames;
	let stack;
	try {
		stack = new PristineError().stack;
	} finally {
		PristineError.stackTraceLimit = previousLimit;
		PristineError.prepareStackTrace = previousPrepare;
	}
	if (stack?.structured) return stack;
	// An engine without V8's call-site hook formats the trace as text, which is parsed instead.
	// The `?? ""` arm covers an Error with no stack, which no engine slothlet runs on produces.
	/* v8 ignore next */
	const frames = [];
	for (const line of String(stack ?? "").split("\n")) {
		const frame = parseStackFrame(line);
		if (frame) {
			frames.push({
				...frame,
				line,
				async: /^at async /.test(line.trim()),
				evaluated: /\beval at\b/.test(line),
				hash: null,
				key: null,
				enter: runtime_entryKind(frame.head),
				gap: false
			});
		}
	}
	frames.truncated = frames.length >= limit;
	frames.trailingGap = false;
	return frames;
}

/**
 * V8's `prepareStackTrace` hook for {@link runtime_captureFrames}: the call sites as frames, without
 * formatting them.
 * @param {Error} _error - The error being captured.
 * @param {Array<object>} callSites - V8 call sites, innermost first.
 * @returns {{structured: true, truncated: boolean, trailingGap: boolean}} The frames, iterable innermost first.
 * @private
 */
function runtime_structuredFrames(_error, callSites) {
	// Converted as the resolver walks them, innermost first: it usually stops within the first few.
	return {
		[Symbol.iterator]: () => runtime_siteFrames(callSites, false),
		// The same frames, in the same order, with slothlet's own described only by where they are and what they enter:
		// for a reader that passes over slothlet's own frames by those two alone.
		lean: () => runtime_siteFrames(callSites, true),
		structured: true,
		truncated: callSites.length >= PristineError.stackTraceLimit,
		// Whether the outermost frame is a builtin's, which has no location: what began the job is the engine's own.
		trailingGap: callSites.length > 0 && runtime_isBuiltinSite(callSites[callSites.length - 1])
	};
}

/**
 * V8 call sites as frames, innermost first, each converted as it is reached.
 * @param {Array<object>} callSites - V8 call sites, innermost first.
 * @param {boolean} lean - Describe a frame located in slothlet's own folder by its `path` and `enter` alone.
 * @returns {Generator<object>} The frames.
 * @private
 */
function* runtime_siteFrames(callSites, lean) {
	// Whether a frame with no location (a builtin's) was passed over since the last one yielded.
	let gap = false;
	for (const site of callSites) {
		// An eval'd frame names the file it was evaluated from in its origin, as the formatted text does.
		const sourceURL = site.getScriptNameOrSourceURL?.() ?? null;
		const fileName = site.getFileName?.() ?? null;
		const location = sourceURL ?? fileName;
		if (lean && location) {
			const described = runtime_comparableLocation(location);
			if (described.path.startsWith(FRAMEWORK_PREFIX)) {
				yield { path: described.path, enter: runtime_entryKind(site.getFunctionName?.() ?? site.getMethodName?.() ?? "") };
				gap = false;
				continue;
			}
		}
		const evaluated = Boolean(site.isEval?.());
		const origin = evaluated ? String(site.getEvalOrigin?.() ?? "") : "";
		if (!location && !origin) {
			gap = true;
			continue;
		}
		const typeName = site.isToplevel?.() ? null : site.getTypeName?.();
		const name = site.getFunctionName?.() ?? site.getMethodName?.() ?? "";
		const head = `at ${site.isAsync?.() ? "async " : ""}${typeName && name ? `${typeName}.` : ""}${name}`;
		const described = runtime_comparableLocation(location ?? origin);
		yield {
			head,
			path: described.path,
			location: location ?? origin,
			line: `${head} (${location ?? ""}) ${origin}`,
			async: Boolean(site.isAsync?.()),
			// Evaluated code, or code naming a source it was not loaded from (a `//# sourceURL`): its location
			// is whatever the evaluating code chose, so it cannot attribute anything to anyone (#597).
			evaluated: evaluated || (sourceURL !== null && fileName !== null && sourceURL !== fileName),
			// The script the frame runs in — the SHA-256 of the source it was compiled from, on every Node slothlet
			// supports (22.15+): code compiled under another module's location runs in a script of its own, with its
			// own hash (#597).
			hash: evaluated ? null : (site.getScriptHash?.() ?? null),
			key: described.key,
			enter: runtime_entryKind(name),
			gap,
			// Where in its file the frame runs: the leaf whose source range holds it is its definer (#726).
			lineNumber: site.getLineNumber?.() ?? null,
			columnNumber: site.getColumnNumber?.() ?? null,
			// Where the function the frame runs in starts: the start of a leaf's own function when the frame is that
			// function itself, not one nested in it.
			enclosingLine: site.getEnclosingLineNumber?.() ?? null,
			enclosingColumn: site.getEnclosingColumnNumber?.() ?? null
		};
		gap = false;
	}
}

/**
 * Whether a V8 call site is a builtin's (`Reflect.get`, a bound function's target): it has no location and was not
 * evaluated.
 * @param {object} site - A V8 call site.
 * @returns {boolean} True for a builtin's.
 * @private
 */
function runtime_isBuiltinSite(site) {
	return !(site.getScriptNameOrSourceURL?.() ?? site.getFileName?.()) && !site.isEval?.();
}

/**
 * Comparable forms of frame locations already seen, with the key their script hashes are kept under. A stack names a
 * bounded set of code locations, read on every capture; the cap only guards a process that evaluates an unbounded
 * number of distinct sources.
 * @type {Map<string, {path: string, key: string}>}
 * @private
 */
const COMPARABLE_LOCATIONS = new Map();

/**
 * {@link toComparablePath} for a frame location, remembered, with its script key (see {@link runtime_scriptKey}).
 * @param {string} location - A frame's location.
 * @returns {{path: string, key: string}} Its comparable form and script key.
 * @private
 */
function runtime_comparableLocation(location) {
	let described = COMPARABLE_LOCATIONS.get(location);
	if (described === undefined) {
		const path = toComparablePath(location);
		described = { path, key: runtime_scriptKey(path, location) };
		if (COMPARABLE_LOCATIONS.size >= 4096) COMPARABLE_LOCATIONS.clear();
		COMPARABLE_LOCATIONS.set(location, described);
	}
	return described;
}

/**
 * The key a location's script hashes are kept under: everything frame placement reads from a location — its
 * comparable path, and the instance and mount tags — and nothing else, so two spellings that place a frame the same
 * way share one key (#597).
 * @param {string} path - The location's comparable form.
 * @param {string} location - The location as the frame names it.
 * @returns {string} The key.
 * @private
 */
function runtime_scriptKey(path, location) {
	return `${path}\u0000${runtime_frameInstanceTag(location) ?? ""}\u0000${runtime_frameModuleTag(location) ?? ""}`;
}

/**
 * The scripts each location's code was learned to run in, by script key (#597): from the frame a leaf's own function
 * runs in when slothlet enters it. The loader's record of the sources files were loaded from is read beside it (see
 * {@link runtime_knowsScript}). The newest few are kept per key, and an instance's keys go when it shuts down.
 * @type {Map<string, Array<string>>}
 * @private
 */
const SCRIPT_HASHES = new Map();

// The loader keeps what it records under the key a frame's location is read under.
setScriptKey((url) => runtime_comparableLocation(url).key);

/**
 * Add a script hash to a location's.
 * @param {string} key - The location's script key.
 * @param {string} hash - The hash.
 * @returns {void}
 * @private
 */
function runtime_rememberScript(key, hash) {
	let hashes = SCRIPT_HASHES.get(key);
	if (!hashes) SCRIPT_HASHES.set(key, (hashes = []));
	rememberNewest(hashes, hash);
}

/**
 * The scripts a location's code is known to run in — learned, or recorded by the loader — as whether any is known
 * and whether a given one is.
 * @param {string} key - The location's script key.
 * @param {string} [hash] - A script's hash.
 * @returns {{known: boolean, has: boolean}} The answer.
 * @private
 */
function runtime_knowsScript(key, hash) {
	const learned = SCRIPT_HASHES.get(key);
	const loaded = loadedScriptLookup(key, hash);
	return {
		known: Boolean(learned?.length) || loaded.known,
		has: (hash !== undefined && Boolean(learned?.includes(hash))) || loaded.has
	};
}

/**
 * How many locations have scripts learned (see {@link SCRIPT_HASHES}).
 * @returns {number} The count.
 * @internal
 * @example
 * learnedScriptCount(); // 8
 */
export function learnedScriptCount() {
	return SCRIPT_HASHES.size;
}

/**
 * The CommonJS files of instances that have shut down (#597), in comparable form. A CommonJS file runs under its plain
 * path, with no instance's tag, so code a gone instance made there — a function it handed out, a timer it set — is
 * told from a live call's only by the path: while no live instance loads the file, a frame there is accounted for by
 * no call, rather than read as whichever call is waiting.
 * @type {Set<string>}
 * @private
 */
const RETIRED_COMMONJS = new Set();

/**
 * Forget the scripts learned for an instance's own copies of its files, when it shuts down (#597), and remember its
 * CommonJS files as a gone instance's (see {@link RETIRED_COMMONJS}). Called before the instance's scope is released.
 * @param {string} instanceID - The instance.
 * @returns {void}
 * @internal
 * @example
 * forgetInstanceScripts(instanceID);
 */
export function forgetInstanceScripts(instanceID) {
	if (instanceID == null) return;
	for (const key of SCRIPT_HASHES.keys()) if (scriptKeyInstance(key) === String(instanceID)) SCRIPT_HASHES.delete(key);
	for (const location of runtime_commonJSLocations(instanceID)) RETIRED_COMMONJS.add(location);
}

/**
 * Whether a frame runs in a script other than every one its location's code was seen to run in: code compiled under
 * that location by someone else (`vm.runInThisContext`, `new vm.Script`, `vm.compileFunction`, `Module#_compile`),
 * which can name any file it likes (#597). A location with no script known, or an engine that reports no hash, says
 * nothing either way.
 * @param {{hash: string|null, key: string|null}} frame - A frame.
 * @returns {boolean} True when the frame cannot be the location's own code.
 * @internal
 */
export function isForeignScript(frame) {
	if (!frame.hash || !frame.key) return false;
	const { known, has } = runtime_knowsScript(frame.key, frame.hash);
	return known && !has;
}

/**
 * The SHA-256 of each file's source as it is on disk, by comparable path, with the modification time it was read at
 * (#597). A file is read once; it is read again only when a frame's script differs from it and the file has changed
 * since — or, for one that could not be read, has appeared or changed since.
 * @type {Map<string, {mtimeMs: number, hashes: Set<string>}>}
 * @private
 */
const FILE_SOURCE_HASHES = new Map();

/**
 * The SHA-256 hashes a file's source as it is on disk can be compiled under. V8 hashes the text it compiles, which
 * the loaders decode from the file as UTF-8 — a byte that is not UTF-8 becomes U+FFFD — without a byte-order mark;
 * the hash of the bytes themselves (with and without a byte-order mark) is accepted as well.
 * @param {string} path - A comparable path.
 * @returns {{mtimeMs: number, hashes: Set<string>}} The hashes, none when the file cannot be read, with the
 *   modification time read (-1 when the file cannot be found).
 * @private
 */
function runtime_readFileSourceHashes(path) {
	let mtimeMs = -1;
	try {
		mtimeMs = nodeFs(FS_STAT, path).mtimeMs;
		const source = nodeFs(FS_READ_FILE, path);
		const text = Reflect.apply(TEXT_DECODE, new CapturedTextDecoder(), [source]);
		const hashes = new Set([sha256(source), sha256(text)]);
		if (source[0] === 0xef && source[1] === 0xbb && source[2] === 0xbf) hashes.add(sha256(source.subarray(3)));
		return { mtimeMs, hashes };
	} catch {
		// A file that is not there (a name code was compiled under), or cannot be read, runs nothing of its own — until
		// it is there, or changes: its modification time is checked again then.
		return { mtimeMs, hashes: new Set() };
	}
}

/**
 * Whether a frame placed by its plain path alone runs that file's own source (#597): the script it runs in is one
 * its location's own code was seen to run in, or hashes as the file on disk does. Code compiled by someone under a
 * file name in a module's folder (`vm.compileFunction`, `Module#_compile`) names a file that is not there, or one
 * whose source is not the code. Outside Node, or on an engine that reports no script hash, there is nothing to
 * compare and the frame is taken as placed.
 * @param {{path: string, hash: string|null, key: string|null}} frame - A frame.
 * @returns {boolean} True when the frame runs the file's own source.
 * @private
 */
function runtime_runsFileSource(frame) {
	if (!isNode || !frame.hash) return true;
	// The scripts the loader recorded, a CommonJS file's among them, and those learned are its own code's (#597).
	if (frame.key && runtime_knowsScript(frame.key, frame.hash).has) return true;
	// Under vitest, the script its runner compiles a file's code into, as recorded before slothlet loaded (#714): only a
	// record that existed then is taken (see RUNNER_SNAPSHOT); one added later is not read.
	if (RUNNER_SNAPSHOT.scripts.get(frame.path)?.has(frame.hash)) return true;
	let known = FILE_SOURCE_HASHES.get(frame.path);
	if (known === undefined) {
		known = runtime_readFileSourceHashes(frame.path);
		if (FILE_SOURCE_HASHES.size >= 4096) FILE_SOURCE_HASHES.clear();
		FILE_SOURCE_HASHES.set(frame.path, known);
	}
	if (known.hashes.has(frame.hash)) return true;
	// The file may have changed since it was read (an edit before a reload): it is read again only then.
	let mtimeMs;
	try {
		mtimeMs = nodeFs(FS_STAT, frame.path).mtimeMs;
	} catch {
		return false;
	}
	if (mtimeMs === known.mtimeMs) return false;
	const fresh = runtime_readFileSourceHashes(frame.path);
	FILE_SOURCE_HASHES.set(frame.path, fresh);
	return fresh.hashes.has(frame.hash);
}

/**
 * The script keys that frames of one capture run under in two different scripts, among locations with no script
 * known: one of them is not the location's own code, and which cannot be told (#597).
 * @param {Array<object>} frames - Frames.
 * @returns {Set<string>|null} The keys, or null when there are none.
 * @private
 */
function runtime_conflictingScripts(frames) {
	let seen = null;
	let conflicts = null;
	for (const frame of frames) {
		if (!frame.hash || !frame.key || runtime_knowsScript(frame.key).known) continue;
		seen ??= new Map();
		const hash = seen.get(frame.key);
		if (hash === undefined) seen.set(frame.key, frame.hash);
		else if (hash !== frame.hash) (conflicts ??= new Set()).add(frame.key);
	}
	return conflicts;
}

/**
 * Leaves being entered by slothlet right now, innermost last, each with whether its function is one whose frame can
 * be learned from: the frame directly inside {@link slothlet_enterLeaf}'s is that function's own (#597).
 * @type {Array<{wrapper: object, learnable: boolean}>}
 * @private
 */
const ENTERING = [];

/**
 * Whether a function's own frame is the code it was written as: not a builtin, nor a bound function (whose frame is
 * its target's), nor a Proxy. Decided once per function from `Function.prototype.toString`, which runs no user code.
 * @type {WeakMap<Function, boolean>}
 * @private
 */
const LEARNABLE = new WeakMap();

/**
 * Whether a frame inside {@link slothlet_enterLeaf} running `fn` is `fn`'s own.
 * @param {Function} fn - A leaf's function.
 * @returns {boolean} True when its frame can be learned from.
 * @private
 */
function runtime_isLearnable(fn) {
	let learnable = LEARNABLE.get(fn);
	if (learnable === undefined) {
		try {
			learnable = !util.types.isProxy(fn) && !/\{\s*\[native code\]\s*\}\s*$/.test(functionSource(fn));
		} catch {
			learnable = false;
		}
		LEARNABLE.set(fn, learnable);
	}
	return learnable;
}

/**
 * Which of slothlet's entry functions a frame's function is: `"leaf"` for {@link slothlet_enterLeaf}, `"call"` for
 * {@link slothlet_enterCall}, null otherwise. A frame with one of these names outside slothlet's own files is not
 * one: callers check the path too.
 * @param {string} name - The frame's function name or head.
 * @returns {"leaf"|"call"|null} The kind.
 * @private
 */
function runtime_entryKind(name) {
	if (!name || !name.includes("slothlet_enter")) return null;
	if (/\bslothlet_enterLeaf\b/.test(name)) return "leaf";
	if (/\bslothlet_enterCall\b/.test(name)) return "call";
	return null;
}

/**
 * Enter a module call's function: every call a context manager runs under a module's identity goes through here,
 * so the frames of the call's own code end at a frame of this function's (#597). A leaf's own function is entered
 * through {@link slothlet_enterLeaf}, which also lets its script be learned.
 * @param {object} wrapper - The call's wrapper.
 * @param {Function} fn - The function to run.
 * @param {*} thisArg - Its receiver.
 * @param {ArrayLike<*>} args - Its arguments.
 * @returns {*} What it returned.
 * @internal
 */
export function enterCall(wrapper, fn, thisArg, args) {
	const impl = wrapper.____slothletInternal?.impl;
	if (fn === impl || fn === runtime_ownDefault(impl)) return slothlet_enterLeaf(wrapper, fn, thisArg, args);
	return slothlet_enterCall(fn, thisArg, args);
}

/**
 * An implementation's own `default`, read without running any code of the module's: only a data property of an
 * object that is not a Proxy (whose traps are the module's code, #597), never a getter's.
 * @param {*} impl - A wrapper's implementation.
 * @returns {*} Its `default`, or undefined.
 * @private
 */
function runtime_ownDefault(impl) {
	if (!impl || typeof impl !== "object" || util.types.isProxy(impl)) return undefined;
	try {
		const descriptor = Objects.getOwnPropertyDescriptor(impl, "default");
		return descriptor && "value" in descriptor ? descriptor.value : undefined;
	} catch {
		// A module namespace whose `default` binding is not initialised yet has none to compare against.
		return undefined;
	}
}

/**
 * Run a leaf's own function, recording it as being entered (see {@link ENTERING}).
 * @param {object} wrapper - The leaf's wrapper.
 * @param {Function} fn - Its function.
 * @param {*} thisArg - Its receiver.
 * @param {ArrayLike<*>} args - Its arguments.
 * @returns {*} What it returned.
 * @private
 */
function slothlet_enterLeaf(wrapper, fn, thisArg, args) {
	ENTERING.push({ wrapper, learnable: runtime_isLearnable(fn) });
	try {
		return Reflect.apply(fn, thisArg, args);
	} finally {
		ENTERING.pop();
	}
}

/**
 * Run any other function a context manager runs under a module's identity (a pinned callback, a hook handler).
 * @param {Function} fn - The function.
 * @param {*} thisArg - Its receiver.
 * @param {ArrayLike<*>} args - Its arguments.
 * @returns {*} What it returned.
 * @private
 */
function slothlet_enterCall(fn, thisArg, args) {
	return Reflect.apply(fn, thisArg, args);
}

/**
 * Learn the scripts of the leaves whose entry frames a capture holds (#597): the frame directly inside a
 * {@link slothlet_enterLeaf} frame is the entered leaf's own function, so the script it runs in is that location's —
 * when the location is the leaf's own module's and nothing (a builtin) ran in between.
 * @param {Array<object>} frames - Frames, innermost first.
 * @returns {void}
 * @private
 */
function runtime_learnEntered(frames) {
	let depth = 0;
	for (let index = 0; index < frames.length; index++) {
		const frame = frames[index];
		if (frame.enter !== "leaf" || !frame.path.startsWith(FRAMEWORK_DIR + "/")) continue;
		const entering = ENTERING[ENTERING.length - 1 - depth++];
		const own = frames[index - 1];
		if (!entering?.learnable || frame.gap || !own?.hash || !own.key || own.path.startsWith(FRAMEWORK_DIR + "/")) continue;
		if (runtime_isOwnModuleLocation(entering.wrapper, own.path)) runtime_rememberScript(own.key, own.hash);
	}
}

/**
 * Whether a location is a file of a leaf's own module: its own file, or one under its module's folder.
 * @param {object} wrapper - The leaf's wrapper.
 * @param {string} path - The location's comparable form.
 * @returns {boolean} True when it is.
 * @private
 */
function runtime_isOwnModuleLocation(wrapper, path) {
	const description = describeCall(wrapper);
	if (
		path === description.comparablePath ||
		(description.comparablePath && path.endsWith("/" + description.comparablePath)) ||
		path === description.realComparablePath ||
		description.locations?.has(path)
	) {
		return true;
	}
	const cache = wrapper.slothlet?.handlers?.apiCacheManager;
	if (!cache) return false;
	return runtime_moduleRoots(cache).some(({ moduleID, root }) => moduleID === description.moduleID && path.startsWith(root + "/"));
}

/**
 * Split one stack-trace line into the text naming the function and the location it runs at.
 *
 * Attribution must be decided by the location alone. The function name is printed first and is not
 * trustworthy — a computed method key (`{ ["/path/to/other/module.mjs"]() {} }`) puts arbitrary text,
 * including another module's path, into it. So the location is taken from where each engine puts
 * it, never searched for anywhere in the line:
 *
 * - V8: `at name (location)` — the last balanced parenthesis group — or `at [async ]location`.
 * - SpiderMonkey / JavaScriptCore: `name@location` — after the last `@` that starts a URL or path.
 *
 * The trailing `:line:column` is removed and the location reduced with {@link toComparablePath}.
 *
 * @param {string} line - One line of `Error#stack`.
 * @returns {{head: string, path: string}|null} The text before the location and the location's
 *   comparable path, or null for a line that is not a frame (the message line, an unbalanced one).
 * @internal
 *
 * @example
 * parseStackFrame("    at run (file:///srv/app/api/run.mjs?q=1:4:9)"); // { head: "at run ", path: "/srv/app/api/run.mjs" }
 * parseStackFrame("run@http://host/api/run.mjs:4:9"); // { head: "run", path: "http://host/api/run.mjs" }
 */
export function parseStackFrame(line) {
	const text = String(line).trim();
	let head = "";
	let location;
	if (text.startsWith("at ")) {
		if (text.endsWith(")")) {
			// Walk back from the closing parenthesis to its partner, so a location containing
			// parentheses of its own (`C:/Program Files (x86)/…`) stays whole.
			let depth = 0;
			let open = -1;
			for (let index = text.length - 1; index >= 0; index--) {
				if (text[index] === ")") depth++;
				else if (text[index] === "(" && --depth === 0) {
					open = index;
					break;
				}
			}
			if (open < 0) return null;
			head = text.slice(0, open);
			location = text.slice(open + 1, -1);
		} else {
			location = text.replace(/^at (?:async )?/, "");
		}
	} else {
		let at = -1;
		for (const match of text.matchAll(/@(?=[a-z][a-z0-9+.-]*:|\/)/gi)) at = match.index;
		if (at < 0) return null;
		head = text.slice(0, at);
		location = text.slice(at + 1);
	}
	return { head, path: toComparablePath(location.replace(/:\d+(?::\d+)?$/, "")) };
}

/**
 * Directory holding slothlet's own sources (`src/` or `dist/`).
 *
 * The frames at the top of every capture are the framework's — the gate, the wrapper, this
 * resolver. They are never attributed to a module by folder, even when a module's root folder
 * happens to contain slothlet's install (a base of `./` with slothlet in `node_modules`).
 * @type {string}
 * @private
 */
export const FRAMEWORK_DIR = toComparablePath(new URL("../../", import.meta.url).href);

/**
 * What the path of every frame of slothlet's own code starts with.
 * @type {string}
 * @private
 */
const FRAMEWORK_PREFIX = FRAMEWORK_DIR + "/";

/**
 * Descriptions of a call's wrapper, by wrapper: what a frame is compared against. Kept with the
 * implementation and file they were built for, so a reload that swaps either rebuilds it.
 * @type {WeakMap<object, {impl: *, filePath: string|null, description: object}>}
 * @private
 */
const DESCRIPTIONS = new WeakMap();

/**
 * How a call's wrapper is recognised in a stack frame: its file in comparable form (and its real path
 * when a symlink makes that differ), the locations its module was imported from, its mount and api path,
 * and the names its function goes by. Built once per wrapper and implementation.
 *
 * @param {object} wrapper - A genuine UnifiedWrapper.
 * @returns {{filePath: string|null, comparablePath: string, realComparablePath: string|null, locations: Set<string>|null, moduleID: string|null, apiPath: string, fnName: string, fnNames: string[]}} The description.
 * @internal
 */
export function describeCall(wrapper) {
	// A live wrapper always carries its internals, file and api path; the fallbacks describe a partial one
	// (a direct caller's stand-in) as having no file.
	/* v8 ignore start */
	const internal = wrapper?.____slothletInternal;
	const impl = internal?.impl;
	const filePath = internal?.filePath ?? null;
	const apiPath = internal?.apiPath ?? "";
	/* v8 ignore stop */
	const cached = DESCRIPTIONS.get(wrapper);
	if (cached && cached.impl === impl && cached.filePath === filePath) return cached.description;
	const description = {
		filePath,
		// The same file as a stack frame spells it, compared by the resolver (relative to the manifest root
		// in browser mode).
		comparablePath: toComparablePath(filePath),
		// The file's real path when a symlink makes it differ, as a Node stack frame names it.
		realComparablePath: runtime_realComparablePath(filePath),
		// The URL this mount's copy of the file was imported from, which need not end in its path (a browser
		// resolver's `blob:` / `data:` URL, a TypeScript leaf's compiled copy).
		locations: runtime_importedLocations(wrapper, filePath),
		// Owning module, so a frame in any file of that module can be attributed to this call.
		/* v8 ignore next */
		moduleID: internal?.moduleID ?? null,
		apiPath,
		// Leaf segment of the api path — the function name as it appears in a stack frame.
		fnName: apiPath.slice(apiPath.lastIndexOf(".") + 1),
		// The names the function goes by on a stack: its api key, and its own name when that differs.
		fnNames: runtime_entryNames(apiPath, wrapper)
	};
	DESCRIPTIONS.set(wrapper, { impl, filePath, description });
	return description;
}

/**
 * The module root folders of the instances some calls belong to, longest first.
 *
 * Taken from each instance's module cache — the folder every `base`/`api.add()` module was loaded from —
 * so a frame in any file of a module's folder can be attributed to that module, not only a frame in the
 * exact file its call entered through. Synthetic (in-memory) modules have no folder and contribute
 * nothing. Longest first so a module mounted from inside another module's folder owns its own files.
 *
 * @param {Array<{currentWrapper: object}>} candidates - Calls being placed.
 * @returns {Array<{moduleID: string, root: string}>} Module roots, longest first.
 * @private
 */
function runtime_moduleRootsFor(candidates) {
	// Every candidate is a live wrapper, which always reaches its instance's cache; the optional chain
	// guards a partially-built wrapper handed in by a direct caller.
	/* v8 ignore next */
	const caches = new Set(candidates.map((entry) => entry.currentWrapper?.slothlet?.handlers?.apiCacheManager).filter(Boolean));
	// One instance's roots are kept between reads as they are; several instances' are merged, deepest first.
	if (caches.size === 1) return runtime_moduleRoots([...caches][0]);
	const roots = [];
	for (const cache of caches) roots.push(...runtime_moduleRoots(cache));
	return roots.sort((a, b) => b.root.length - a.root.length);
}

/**
 * Build the frame placer for a set of calls.
 *
 * A frame is placed by its location (never by its function name alone, see {@link parseStackFrame}):
 *
 * - **a call's file** — the file it entered through, or a URL the browser loader imported that file from
 *   (a resolver's `blob:` / `data:` URL need not end in the manifest path);
 * - **instance code** — a frame carrying an instance's import tag, or in one of its CommonJS copies, is that
 *   instance's code, and belongs to the calls of that instance whose leaves import its file (the import
 *   graph the instance's resolve hook records). Instance code that none of the calls imports is an orphan:
 *   some module is running that none of them accounts for;
 * - **a module's folder** — an untagged frame (a browser leaf's own imports carry no tag) in a module's root
 *   folder belongs to that module's calls (#512); the deepest root wins, so a module mounted inside
 *   another's folder owns its files.
 *
 * @param {Array<{currentWrapper: object, family: string|null, comparablePath: string, realComparablePath: string|null, locations: Set<string>|null, moduleID: string|null}>} candidates - The calls, each with a file.
 * @returns {{place: function(object): ({matches: Array<object>, byFile: boolean, byModule?: boolean}|null), families: Set<string>}}
 *   `place` answers a frame's placement — `{ matches }` (possibly none: an orphan), or null when the frame is
 *   no instance's code and in no module's folder; `byFile` marks a frame in a call's own file, whose
 *   function name may pin one of several. `families` are the instances the calls belong to.
 * @internal
 */
export function createFramePlacer(candidates) {
	const roots = runtime_moduleRootsFor(candidates);
	const families = new Set(candidates.map((entry) => entry.family).filter(Boolean));

	// The CommonJS helpers each instance's leaves required run under their plain path, untagged; a frame
	// in one of them is that instance's code all the same. Node loads a CommonJS file once, so several
	// instances built from one folder share it: a path maps to every instance that required it.
	const commonJSFamiliesAt = (location) => {
		let found;
		for (const family of families) {
			if (runtime_commonJSLocations(family).has(location)) (found ??= new Set()).add(family);
		}
		return found;
	};

	// The files that import a file of an instance, transitively, and the file itself.
	const importersOf = (family, location) => {
		const graph = runtime_importGraph(family);
		const seen = new Set([location]);
		const queue = [location];
		while (queue.length) {
			for (const importer of graph.get(queue.pop()) ?? []) {
				if (!seen.has(importer)) {
					seen.add(importer);
					queue.push(importer);
				}
			}
		}
		return seen;
	};

	// A browser-mode wrapper records its file relative to the manifest root, so a relative path matches as a
	// whole-segment suffix of a location; an absolute one must be equal. A file reached through a symlink is
	// matched by its real path too, as Node reports it.
	const isEntryLocation = (location, entry) =>
		location === entry.comparablePath ||
		location.endsWith("/" + entry.comparablePath) ||
		(entry.realComparablePath !== null && location === entry.realComparablePath) ||
		Boolean(entry.locations?.has(location));

	// The files the candidates' instances loaded under their tag: every leaf, and every file of their import
	// graphs. The sets are cached across reads and rebuilt only when their instance loads more.
	let tagged = null;
	const isInstanceFile = (location) => {
		if (!tagged) {
			// Every candidate is a live wrapper, which always reaches its loader; the chain guards a partial one.
			/* v8 ignore next */
			const loaders = new Set(candidates.map((entry) => entry.currentWrapper?.slothlet?.processors?.loader).filter(Boolean));
			tagged = [...[...loaders].map(runtime_loadedLocations), ...[...families].map((family) => runtime_importGraphEntry(family).files)];
		}
		return tagged.some((set) => set.has(location));
	};

	const place = (frame) => {
		const frameInstance = runtime_frameInstanceTag(frame.line);
		// In Node slothlet loads every ES module of an instance under its tag, and knows its CommonJS files: an
		// untagged frame at a module's file is another copy of it — a package's or the host's own import — so
		// it is code no call accounts for, not that module's.
		// A file the instance never loads under its tag (a helper reached through `#imports` or a package
		// self-reference, which are shared on purpose) is placed by its folder below.
		if (isNode && !frameInstance && !commonJSFamiliesAt(frame.path) && isInstanceFile(frame.path)) return { matches: [], byFile: false };
		// Two mounts of one folder share the file but not the copy: the frame's mount tag picks its call. A frame carrying
		// the instance's tag but no mount's runs in the copy a raw `import` of the leaf's file loads (#597) — a module of
		// its own, which the call did not enter — so it is placed by who imports it, as any other file is.
		const frameModule = runtime_frameModuleTag(frame.line);
		const byFile = candidates.filter(
			(entry) =>
				isEntryLocation(frame.path, entry) &&
				(!frameInstance || !entry.family || entry.family === frameInstance) &&
				(frameModule ? entry.moduleID === frameModule : !frameInstance || !entry.moduleID)
		);
		if (byFile.length) return { matches: byFile, byFile: true };
		const commonJSFamilies = frameInstance ? null : commonJSFamiliesAt(frame.path);
		const frameFamilies = frameInstance ? new Set([frameInstance]) : commonJSFamilies;
		if (frameFamilies) {
			const owners = candidates.filter((entry) => {
				if (!frameFamilies.has(entry.family)) return false;
				// A leaf's own copy names its mount: only that mount's calls can be running it.
				if (frameModule && entry.moduleID !== frameModule) return false;
				for (const importer of importersOf(entry.family, frame.path)) if (isEntryLocation(importer, entry)) return true;
				return false;
			});
			// A CommonJS file runs under its plain path, which code compiled by someone can name too (#597).
			return { matches: owners, byFile: false, unverified: Boolean(commonJSFamilies) };
		}
		// A helper vitest's runner loaded for a leaf (slothlet itself run by the runner, so Node's loader never saw the
		// import): the leaves its record names as importers, directly or through other such helpers (#714).
		if (!frameInstance) {
			const importers = runtime_runnerTaggedImporters(frame.path);
			const owners = importers.length
				? candidates.filter((entry) =>
						importers.some(
							(importer) =>
								importer.family === entry.family &&
								(!importer.mount || importer.mount === entry.moduleID) &&
								isEntryLocation(importer.location, entry)
						)
					)
				: [];
			if (owners.length) return { matches: owners, byFile: false, unverified: true };
		}
		// A CommonJS file only a gone instance loaded: its code is accounted for by no live call.
		if (isNode && !frameInstance && RETIRED_COMMONJS.has(frame.path)) return { matches: [], byFile: false };
		const owner = roots.find(({ root }) => frame.path.startsWith(root + "/"));
		if (owner)
			return { matches: candidates.filter((entry) => entry.moduleID === owner.moduleID), byFile: false, byModule: true, unverified: true };
		return null;
	};

	return { place, families };
}

/**
 * Whether a frame is one the microtask runner puts below a resumed function: a resumed function has
 * nothing of its own below it. Node also drains the microtask queue between the callbacks of one timer list and of
 * the immediate queue, so a function resumed there has the timers' own frames (`listOnTimeout`, `processTimers`,
 * `processImmediate`) below the runner's.
 * @param {{path: string, head: string}} frame - A frame.
 * @returns {boolean} True for a runner frame.
 * @internal
 */
export function isRunnerFrame(frame) {
	return (
		frame.path.startsWith("node:internal/process/task_queues") ||
		frame.path === "node:internal/timers" ||
		/\b(?:processTicksAndRejections|runMicrotasks)\b/.test(frame.head)
	);
}

/**
 * The comparable spellings of a folder being built (#597): its comparable form with `.` and `..` segments collapsed, as a
 * frame names the files inside it, and its real path when it is reached through a symlink.
 * @param {*} root - The folder as the build was given it.
 * @returns {Array<string>} Its spellings; none for an empty or non-string folder, or one naming the filesystem root.
 * @private
 */
function runtime_rootSpellings(root) {
	if (typeof root !== "string" || !root) return [];
	const comparable = toComparablePath(root);
	const absolute = comparable.startsWith("/");
	const segments = [];
	for (const segment of comparable.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			if (segments.length && segments[segments.length - 1] !== "..") segments.pop();
			else if (!absolute) segments.push(segment);
			continue;
		}
		segments.push(segment);
	}
	const collapsed = (absolute ? "/" : "") + segments.join("/");
	const spellings = [];
	// An empty root (or `/`) would own every absolute path; it owns nothing.
	if (collapsed && collapsed !== "/") spellings.push(collapsed);
	const real = runtime_realComparablePath(root);
	if (real && real !== collapsed) spellings.push(real);
	return spellings;
}

/**
 * Whether the current stack holds code of an instance's own (#597): a frame carrying the instance's import tag, in one
 * of its CommonJS files, at a location its loader imported or its import graph names, or under one of its modules'
 * folders or a folder being built for it. A stack with none of these is the host's.
 *
 * Read in full: a stack deeper than the first capture reads is captured again with no frame limit, so only a frame
 * of the instance's own makes it so.
 *
 * @param {Array<{family: string, slothlet: object|null, roots: Array<string>}>} sources - The instances, each with the
 *   absolute folders being built for it.
 * @returns {boolean} True when a frame is code of one of them.
 * @internal
 */
export function stackHoldsInstanceCode(sources) {
	const families = new Set(sources.map(({ family }) => family));
	const locations = [];
	const roots = [];
	for (const { family, slothlet, roots: building } of sources) {
		locations.push(runtime_commonJSLocations(family), runtime_importGraphEntry(family).files);
		const loader = slothlet?.processors?.loader;
		if (loader) locations.push(runtime_loadedLocations(loader));
		const cache = slothlet?.handlers?.apiCacheManager;
		if (cache) for (const { root } of runtime_moduleRoots(cache)) roots.push(root);
		for (const root of building) roots.push(...runtime_rootSpellings(root));
	}
	const holds = (frames) => {
		for (const frame of frames) {
			if (frame.path.startsWith(FRAMEWORK_DIR + "/")) continue;
			const tag = runtime_frameInstanceTag(frame.line);
			if (tag && families.has(tag)) return true;
			if (locations.some((set) => set.has(frame.path))) return true;
			if (roots.some((root) => frame.path.startsWith(root + "/"))) return true;
		}
		return false;
	};
	const frames = runtime_captureFrames(200);
	if (holds(frames)) return true;
	// Cut off before its end: read the whole stack, so a deep stack of the host's own is still the host's.
	return frames.truncated ? holds(runtime_captureFrames(Infinity)) : false;
}

/**
 * Whether a value handed to a call can carry code of the caller's: a non-null object or function that is
 * not one of slothlet's own api nodes. Decided from `typeof` and slothlet's registries alone — reading a
 * property or a prototype would run the caller's own traps and getters.
 *
 * Set by the wrapper module, which owns the registry of api-node proxies; until then only genuine
 * wrappers are recognised.
 * @type {function(*): boolean}
 * @private
 */
let isApiValue = () => false;

/**
 * Register the test that recognises slothlet's own api values (node proxies, per-reader views), which carry
 * no code of a caller's.
 * @param {function(*): boolean} check - The test.
 * @returns {void}
 * @internal
 */
export function setApiValueCheck(check, harborsCode = null) {
	isApiValue = check;
	if (harborsCode) apiValueHarborsCode = harborsCode;
}

/**
 * What a module's call returned, as its caller receives it (#597): code the module made, set up to run as that
 * module whoever runs it. Set by the wrapper module; until then a value is returned as it is.
 * @type {function(object, *, boolean): *}
 * @private
 */
let resultAttributor = (_wrapper, value) => value;

/**
 * Register how a module call's result is attributed to the module (see {@link attributeResult}).
 * @param {function(object, *, boolean): *} attributor - Takes the call's wrapper, its result, and whether the host made
 *   the call; returns what the caller gets.
 * @returns {void}
 * @internal
 */
export function setResultAttributor(attributor) {
	resultAttributor = attributor;
}

/**
 * What a module call's result is handed back as: code the module made — a function, a Proxy, a generator, an object
 * holding code — runs as that module whoever runs it, with no ceiling from them (#597).
 * @param {object} wrapper - The call's wrapper.
 * @param {*} value - What the call returned.
 * @param {boolean} [callerIsHost=false] - Whether the host made the call, so is the one receiving what it returned.
 * @param {object|null} [caller=null] - The wrapper of the module that made the call, when one did.
 * @returns {*} What the caller gets.
 * @internal
 */
export function attributeResult(wrapper, value, callerIsHost = false, caller = null) {
	return resultAttributor(wrapper, value, callerIsHost, caller);
}

/**
 * Whether a value a module's call returned to the host is a prototype of a module's class, which the host gets as the
 * object itself (#667). Set by the wrapper module.
 * @type {function(object, *): boolean}
 * @private
 */
let hostPrototypeCheck = () => false;

/**
 * Register how a prototype of a module's class handed to the host is recognised (see {@link isHostPrototype}).
 * @param {function(object, *): boolean} check - Takes the call's wrapper and its result; true for such a prototype.
 * @returns {void}
 * @internal
 */
export function setHostPrototypeCheck(check) {
	hostPrototypeCheck = check;
}

/**
 * Whether a value a module's call returned is a prototype of a module's class (or a view of one), which the host gets
 * as the object itself under either runtime and with the permission system on or off (#667, #726).
 * @param {object} wrapper - The call's wrapper.
 * @param {*} value - What the call returned.
 * @returns {boolean} True for such a prototype.
 * @internal
 */
export function isHostPrototype(wrapper, value) {
	return hostPrototypeCheck(wrapper, value);
}

/**
 * Whether a value is a stand-in slothlet hands a module's code out as (#597). Set by the wrapper module.
 * @type {function(*): boolean}
 * @private
 */
let handedOutCheck = () => false;

/**
 * Register how a stand-in is recognised (see {@link isHandedOut}).
 * @param {function(*): boolean} check - True for a stand-in.
 * @returns {void}
 * @internal
 */
export function setHandedOutCheck(check) {
	handedOutCheck = check;
}

/**
 * Whether a value is a stand-in slothlet hands a module's code out as (#597), already set up to run as its module.
 * @param {*} value - The value.
 * @returns {boolean} True for a stand-in.
 * @internal
 */
export function isHandedOut(value) {
	return handedOutCheck(value);
}

/**
 * The caller's value behind a view a module is handed of it (#597), or the value itself. Set by the wrapper module.
 * @type {function(*): *}
 * @private
 */
let inboundOriginal = (value) => value;

/**
 * Register how the caller's value behind a module's view of it is found (see {@link handedLeafFunctions}).
 * @param {function(*): *} unwrap - The value behind a view, or the value itself.
 * @returns {void}
 * @internal
 */
export function setInboundOriginal(unwrap) {
	inboundOriginal = unwrap;
}

/**
 * Whether one of slothlet's own api values holds code that runs outside the call path that runs a module's code as
 * that module (#597): an accessor the node's impl holds that adoption did not put on the node, or a function under a
 * symbol (an iterator a spread runs, whose generator body resumes as whoever iterates). Handed to a call, such a
 * value counts as able to carry its holder's code. Set by the wrapper module alongside {@link isApiValue}.
 * @type {function(*): boolean}
 * @private
 */
let apiValueHarborsCode = () => false;

/**
 * How many levels of objects plain data may nest, the outermost counted, before it is treated as able to carry
 * code (#597).
 * @type {number}
 * @private
 */
const PLAIN_DATA_DEPTH = 4;

/**
 * How many own properties, all values of one call counted together, plain data may have before it is treated
 * as able to carry code (#597). Bounds what deciding costs for a large argument.
 * @type {number}
 * @private
 */
const PLAIN_DATA_PROPERTIES = 256;

/**
 * Whether a value is plain data, which can run none of the caller's code when a leaf converts, reads or walks
 * it: a primitive, one of slothlet's own api values, or a frozen non-Proxy object whose prototype is
 * `Object.prototype`, `Array.prototype` or `null` and whose own properties are all data properties holding plain
 * data — within {@link PLAIN_DATA_DEPTH} and {@link PLAIN_DATA_PROPERTIES}.
 *
 * Frozen, because the decision is taken once, when the call is entered, and has to hold for as long as the call
 * runs: an object that can still be changed can be given a getter, a `toString` or a prototype — or have a
 * function put in it — by its caller while the leaf awaits, or by code the leaf itself calls back into, and the
 * leaf would then run that code with nothing marking the call (#597). A frozen object keeps its prototype and
 * every property as they were checked.
 *
 * Nothing of the caller's runs while deciding: a Proxy is recognised before anything is read from it, and an
 * ordinary object's frozenness, prototype, keys and property descriptors are read without running a getter. An
 * array's length is checked against the budget before its keys are listed, so a large one is not walked. Without a
 * way to recognise a Proxy (outside Node) no object is plain data.
 *
 * @param {*} value - The value.
 * @param {number} depth - Levels of objects still allowed, this one included.
 * @param {{remaining: number}} budget - Properties still allowed for the call.
 * @returns {boolean} True for plain data.
 * @private
 */
function runtime_isPlainData(value, depth, budget) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return true;
	if (genuineWrappers.has(value)) return true;
	if (isApiValue(value)) return !apiValueHarborsCode(value);
	if (typeof value === "function" || depth <= 0 || !isNode || util.types.isProxy(value)) return false;
	try {
		if (!Objects.isFrozen(value)) return false;
		const prototype = Objects.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return false;
		// A frozen array's `length` is an own data property: reading it runs nothing.
		if (prototype === Array.prototype && Arrays.isArray(value) && value.length > budget.remaining) return false;
		const keys = Reflect.ownKeys(value);
		budget.remaining -= keys.length;
		if (budget.remaining < 0) return false;
		for (const key of keys) {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			if (!descriptor || !Objects.hasOwn(descriptor, "value") || !runtime_isPlainData(descriptor.value, depth - 1, budget)) return false;
		}
		return true;
	} catch {
		// An exotic object that refuses to be read (a module namespace with a binding not yet initialised) is not
		// plain data either.
		return false;
	}
}

/**
 * Whether one value can carry a caller's code into a call.
 * @param {*} value - A receiver or an argument.
 * @param {{remaining: number}} budget - Properties still allowed for the call (see {@link runtime_isPlainData}).
 * @returns {boolean} True for an object or function that is neither slothlet's own nor plain data.
 * @private
 */
const carriesCode = (raw, budget) => {
	// A module's view of a caller's value (an inbound or crossing view) stands for what the caller handed.
	const value = raw !== null && (typeof raw === "object" || typeof raw === "function") ? inboundOriginal(raw) : raw;
	return (
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		!genuineWrappers.has(value) &&
		!runtime_isPlainData(value, PLAIN_DATA_DEPTH, budget)
	);
};

/**
 * Whether a call is handed anything that can run its caller's code while it executes: a receiver or an
 * argument with a `toString`, a getter, a Proxy trap or a callback of the caller's (#597). Plain data does not
 * count (see {@link runtime_isPlainData}). Only such a call ever reads the stack to find who supplied the code
 * that is running.
 *
 * @param {*} thisArg - The call's receiver.
 * @param {ArrayLike<*>|null|undefined} args - The call's arguments.
 * @returns {boolean} True when the call is to be checked for supplied code.
 * @internal
 */
export function carriesCallerCode(thisArg, args) {
	const budget = { remaining: PLAIN_DATA_PROPERTIES };
	if (carriesCode(thisArg, budget)) return true;
	// The arguments are the trap's own array, never the caller's object, so reading them runs nothing.
	const count = args?.length ?? 0;
	for (let index = 0; index < count; index++) if (carriesCode(args[index], budget)) return true;
	return false;
}

/**
 * The api nodes whose own leaf functions a call is handed as values (#597): a receiver or an argument that is a leaf
 * function slothlet wraps — imported raw from its file instead of read from `self` — or one held in plain data the
 * call is handed, within {@link PLAIN_DATA_DEPTH} and {@link PLAIN_DATA_PROPERTIES}. Each is gated for the caller as
 * though it had called it through `self`.
 *
 * Decided from `typeof`, a registry lookup and property descriptors, so nothing of the caller's runs: a Proxy is not
 * looked into, an accessor is not read, and a function hidden behind either (or bound, so it is another function)
 * is not recognised.
 *
 * @param {*} thisArg - The call's receiver.
 * @param {ArrayLike<*>|null|undefined} args - The call's arguments.
 * @returns {Array<object>|null} The wrappers, or null when there are none.
 * @internal
 */
export function handedLeafFunctions(thisArg, args) {
	let found = null;
	const budget = { remaining: PLAIN_DATA_PROPERTIES };
	const visit = (value, depth) => {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
		// A module's view of a caller's value holds what the caller handed: that is what is looked into.
		value = inboundOriginal(value);
		if (typeof value === "function") {
			const wrapper = implWrappers.get(value);
			if (wrapper) (found ??= []).push(wrapper);
			return;
		}
		if (depth <= 0 || budget.remaining <= 0 || genuineWrappers.has(value) || isApiValue(value) || !isNode || util.types.isProxy(value))
			return;
		try {
			const prototype = Objects.getPrototypeOf(value);
			if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return;
			if (prototype === Array.prototype && Arrays.isArray(value) && value.length > budget.remaining) return;
			const keys = Reflect.ownKeys(value);
			budget.remaining -= keys.length;
			if (budget.remaining < 0) return;
			for (const key of keys) {
				const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
				if (descriptor && Objects.hasOwn(descriptor, "value")) visit(descriptor.value, depth - 1);
			}
		} catch {
			// An exotic object that refuses to be read holds nothing that can be found without running its code.
		}
	};
	visit(thisArg, PLAIN_DATA_DEPTH);
	const count = args?.length ?? 0;
	for (let index = 0; index < count; index++) visit(args[index], PLAIN_DATA_DEPTH);
	return found;
}

/**
 * The most calls up a chain looked at for a supplier. Chains are as deep as module calls nest; this bounds
 * the walk for a pathological one.
 * @type {number}
 * @private
 */
const MAX_CHAIN = 64;

/**
 * The calls that handed code down to a call (#726): its parent when the call was handed anything that can carry code,
 * that call's parent when it was too, and so on up, each with the ceiling it already carried. Another module's code
 * running inside the call may be code those calls handed in, and slothlet cannot tell it from code the leaf obtained
 * itself, so it runs under all of them: returning a closure to a module lends that module nothing it can pass on.
 * @param {{parent?: object|null, flagged?: boolean}|null|undefined} record - The call.
 * @returns {object|ReadonlyArray<object>|null} The suppliers as a ceiling, or null when the call was handed no code
 *   by a module.
 * @internal
 * @example
 * combineCeilings(leaf, supplierChainCeiling(record));
 */
export function supplierChainCeiling(record) {
	const parts = [];
	for (let current = record, depth = 0; current?.flagged && current.parent && depth < MAX_CHAIN; current = current.parent, depth++) {
		if (current.parent.wrapper && genuineWrappers.has(current.parent.wrapper)) parts.push(current.parent.wrapper);
		if (current.parent.ceiling) parts.push(current.parent.ceiling);
	}
	return parts.length ? combineCeilings(...parts) : null;
}

/**
 * Who supplied the code that is running inside a call that was handed code (#597).
 *
 * A leaf converting, reading or calling a value its caller handed it runs the caller's code — a `toString`,
 * a getter, a Proxy trap, a callback — and that code is the caller's, not the leaf's. The call record is the
 * leaf's: `{ wrapper, parent, flagged }`, `parent` being the record of the call that made it.
 *
 * The first frame below slothlet's own decides, and it fails closed. The code is the leaf's own only when that
 * frame is placed on the leaf and on no other call of the chain. A frame placed on calls further up names the
 * nearest of them. Anything else — evaluated code (it names whatever source it likes), a frame no call can be
 * placed on, a frame the leaf shares with another call (a helper both import), instance code none of them
 * accounts for, or no frame at all — is taken to be the code of the call that made the leaf's. Whatever is
 * named runs with the leaf as its ceiling, so the answer can only narrow what the leaf may do, never widen it.
 *
 * A flagged call with a module above it is resolved as above. Any other call is read for another module's code
 * running inside it when it was entered by code no call accounts for (see runtime_unaccountedInside), or, while the
 * permission system's `provenance` is on, for the code doing the access (see runtime_foreignCodeRunning), so a
 * function a module passed by any route — a callback, a shared object, a global, a built-in it replaced — runs as no
 * module inside a call it was not handed to; otherwise it answers without reading the stack.
 *
 * The ceiling is the leaf the code is running inside. With `permissions.ceiling: "chain"` it is cumulative instead: the
 * leaf, every call between it and the supplier (the supplier's code runs inside each of them), and every ceiling
 * those calls and the supplier's own call already carried, so a nested resolution cannot shed one an earlier
 * resolution imposed.
 *
 * @param {{wrapper: object, parent: object|null, flagged: boolean, ceiling?: object|null, unaccountedCaller?: boolean}|null|undefined} record - The running call.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|{unaccounted: true}|null} The supplier's wrapper and
 *   the ceiling it runs under when it is a call above the leaf, `{unaccounted: true}` for code no call accounts for,
 *   otherwise null (the leaf's own code is running).
 * @internal
 */
export function resolveSupplier(record) {
	// Code a file started while it loaded: its module is the caller, and the code doing the access is told by its frames.
	if (record?.topLevel)
		return genuineWrappers.has(record.wrapper) && runtime_guardsForeignCode(record) ? runtime_topLevelRunning(record) : null;
	// Code a module handed out, run through the stand-in recording its definer: the stack names the definer wherever it
	// can, and the record stands only where it cannot (#726).
	if (record?.made && genuineWrappers.has(record.wrapper) && runtime_guardsForeignCode(record)) {
		const told = runtime_madeCodeDefiner(record);
		if (told !== undefined) return told;
	}
	if (!record?.flagged)
		return runtime_guardsForeignCode(record) && genuineWrappers.has(record.wrapper) ? runtime_foreignCodeRunning(record) : null;
	const leaf = record.wrapper;
	if (!genuineWrappers.has(leaf)) return null;
	if (!record.parent?.wrapper) {
		if (record.unaccountedCaller) return runtime_unaccountedInside(record);
		return runtime_guardsForeignCode(record) ? runtime_foreignCodeRunning(record) : null;
	}
	const chain = [];
	const seen = new Set([leaf]);
	// The call that made the leaf's: what an unattributable frame is taken to be.
	let fallback = null;
	const leafDescription = describeCall(leaf);
	// A leaf the host added as an object or a function has no file of its own (#717): it is its own entity, at its path,
	// whatever file its function was written in. No frame is placed on it; inside its call, only code its caller handed
	// in runs as the caller (see runtime_isFilelessLeafCode).
	const fileless = runtime_isHostObjectLeaf(leaf, leafDescription.filePath);
	if (!fileless && leafDescription.filePath)
		chain.push({ ...leafDescription, currentWrapper: leaf, family: leaf.slothlet.instanceID, distance: 0, record });
	let current = record.parent;
	for (let depth = 1; current && depth < MAX_CHAIN; depth++, current = current.parent) {
		const wrapper = current.wrapper;
		if (!wrapper || seen.has(wrapper) || !genuineWrappers.has(wrapper)) continue;
		seen.add(wrapper);
		fallback ??= { currentWrapper: wrapper, record: current };
		const description = describeCall(wrapper);
		// A call with no file (an in-memory module) has no frames of its own to be placed on.
		if (!description.filePath) continue;
		chain.push({ ...description, currentWrapper: wrapper, family: wrapper.slothlet.instanceID, distance: chain.length, record: current });
	}
	// No call of a module's above it (only the host's): read as a call with no parent is, so another module's code
	// running inside it is still told by its frames (#726).
	if (!fallback) {
		if (record.unaccountedCaller) return runtime_unaccountedInside(record);
		return runtime_guardsForeignCode(record) ? runtime_foreignCodeRunning(record) : null;
	}
	// Any other leaf with no file of its own (a node a module made): none of the code running inside it can be told to be
	// its own.
	if (!fileless && (!chain.length || chain[0].currentWrapper !== leaf)) return runtime_supplierAnswer(record, fallback);
	const { place } = createFramePlacer(chain);
	// Under provenance, instance code no call of the chain accounts for is its author's (see runtime_authorAnswer).
	const guards = runtime_guardsForeignCode(record);
	let authored = null;

	// The frames of the leaf's call, innermost first, up to where slothlet entered it (or, for a call that resumed after
	// an await, to the microtask runner or the flows awaiting it): frames past that are its caller's, not code running
	// inside it.
	const collect = (frames) => {
		const range = [];
		for (const frame of frames) {
			range.push(frame);
			if ((frame.enter && frame.path.startsWith(FRAMEWORK_DIR + "/")) || frame.async || isRunnerFrame(frame))
				return { range, complete: true };
		}
		return { range, complete: !frames.truncated };
	};

	// Every frame of the call's own counts, not only the innermost: the leaf's function run from a closure its caller
	// handed it (`run(() => useSecret())`) has the caller's frame further out. The code is the leaf's own only when no
	// frame up to the entry is anyone else's.
	const decide = ({ range, complete }) => {
		runtime_learnEntered(range);
		const conflicts = runtime_conflictingScripts(range);
		let leafSeen = false;
		for (let index = 0; index < range.length; index++) {
			const frame = range[index];
			if (frame.path.startsWith(FRAMEWORK_DIR + "/")) continue;
			if (frame.async || isRunnerFrame(frame)) break;
			// Code compiled by someone, under whatever location it chose: it cannot be anyone's own.
			if (frame.evaluated || isForeignScript(frame) || conflicts?.has(frame.key)) return fallback;
			const placement = place(frame);
			if (fileless) {
				// Inside a leaf with no file, code that is no module's (the host's, any package's, one a call up the chain
				// imports too) is the leaf's (#717). A file a module loaded is the caller's.
				if (!placement) {
					if (!runtime_isFilelessLeafCode(record, frame)) return fallback;
					leafSeen = true;
					continue;
				}
				// A module's code no call accounts for (an untagged copy of its file) is the caller's, even once the leaf's own
				// code ran inside it: the leaf's frames never stand for another module's (#717).
				if (!placement.matches.length) return fallback;
			}
			if (!placement || !placement.matches.length) {
				// A frame no call accounts for: the code running is unattributable — unless the leaf's own code is
				// already running inside it (a package the leaf called back into the leaf).
				if (leafSeen) continue;
				if (guards && placement && (authored = runtime_authorAnswer(record, frame, range.slice(index + 1)))) return AUTHORED;
				return fallback;
			}
			const { matches } = placement;
			// Placed by its plain path alone (a module's folder, a CommonJS file): it is that file's code only when it runs
			// the file's own source (#597).
			if (placement.unverified && !runtime_runsFileSource(frame) && !runtime_runsRunnerTransform(frame)) return fallback;
			if (matches.length === 1 && matches[0].currentWrapper === leaf) {
				// Code of the leaf's file written inside another export (a closure a sibling leaf made), with no frame of the
				// leaf's own code between: it may be what the caller handed in, so it runs as its definer under the leaf and
				// the calls that handed code down (#726).
				if (guards && placement.byFile && !leafSeen && (authored = runtime_siblingAuthor(record, frame, range.slice(index + 1))))
					return AUTHORED;
				leafSeen = true;
				continue;
			}
			let nearest = null;
			for (const match of matches) if (match.currentWrapper !== leaf && (!nearest || match.distance < nearest.distance)) nearest = match;
			return nearest ?? fallback;
		}
		if (leafSeen) return complete ? leaf : undefined;
		return complete ? fallback : undefined;
	};

	// The frames that decide sit near the top of the stack, so the capture starts small and is widened only when it was
	// cut short before reaching the leaf's entry.
	let answer = decide(collect(runtime_captureFrames(16)));
	if (answer === undefined) {
		const deeper = collect(runtime_captureFrames(80));
		answer = decide(deeper);
		// Still cut short: the leaf's own frames, as far as they were read, decide.
		if (answer === undefined) answer = deeper.range.some((frame) => !frame.path.startsWith(FRAMEWORK_DIR + "/")) ? leaf : fallback;
	}
	if (answer === AUTHORED) return authored;
	return answer === leaf ? null : runtime_supplierAnswer(record, answer);
}

/**
 * The leaves whose code is on the synchronous stack further out than a frame (#726): each frame of a file an
 * instance's leaves were built from, read as its definer (the nearest leaf frame of its file, or the file's module).
 * They are the callers of the code at that frame when no call slothlet entered says who is: all of them have to be
 * allowed. The walk ends where the synchronous stack does (the microtask runner, a timer, an awaiting flow) or at a
 * call slothlet entered. Frames that name no leaf's file (the host's, a package's, Node's, evaluated code) add none.
 * @param {Iterable<object>} frames - The capture, innermost first.
 * @param {number} index - The index of the frame the callers are further out than.
 * @param {object|null} [slothlet=null] - Read only this instance's leaves; every running instance's when null.
 * @param {boolean} [throughOwnEntry=false] - Pass over the entry slothlet made for the running flow itself, when it
 *   is the first thing further out: a flow the live runtime re-entered (what a file made at load, run from inside
 *   some call) has that entry between its code and the code that ran it, where the async runtime has none.
 * @returns {Array<object>} The callers' wrappers, none when there are none.
 * @private
 */
function runtime_outerCallers(frames, index, slothlet = null, throughOwnEntry = false) {
	const callers = new Set();
	let position = -1;
	// Whether anything but slothlet's own frames has been passed since the frame the walk started after.
	let passedCode = false;
	for (const frame of frames) {
		position++;
		if (position <= index) continue;
		if (frame.path.startsWith(FRAMEWORK_DIR + "/")) {
			if (frame.enter) {
				if (!throughOwnEntry || passedCode) break;
				throughOwnEntry = false;
			}
			continue;
		}
		passedCode = true;
		if (frame.async || isRunnerFrame(frame)) break;
		if (frame.evaluated || frame.path.startsWith("node:") || isForeignScript(frame)) continue;
		const leaves = slothlet ? runtime_leavesAt(slothlet, frame) : runtime_leavesAtLocation(frame.path, frame.line);
		if (!leaves?.length) continue;
		for (const caller of runtime_narrowToLeaf(leaves, frame, runtime_framesAfter(frames, position))) callers.add(caller);
	}
	return [...callers];
}

/**
 * Who is doing an access made from something a file started while it loaded (a timer, a listener, a queue): the file's
 * module is the caller, and the code nearest the access that is not slothlet's or Node's own decides whose code it is.
 * Code outside every export of the module's file, a helper file it imports, the host's and a package's run as the
 * module. Code written inside an export (of this file or another module's) runs as that leaf, its definer, under the
 * module: both have to be allowed, so a closure another module made, or one of the file's own leaves, gains nothing
 * from being run by the module's timer, and lends the module nothing. Code that cannot be placed is refused.
 * @param {{wrapper: object, ceiling?: object|null, file?: string, moduleID?: string|null}} record - The load's record.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|{unaccounted: true}|null} The definer and its
 *   ceiling, unaccounted code, or null when the module's own code is running.
 * @private
 */
function runtime_topLevelRunning(record) {
	const module = record.wrapper;
	const slothlet = module.slothlet;
	const description = describeCall(module);
	// A lazy tree's module node has no file of its own: the load knows the file.
	const filePath = description.filePath ?? record.file ?? null;
	const entry = {
		...description,
		filePath,
		comparablePath: toComparablePath(filePath),
		realComparablePath: runtime_realComparablePath(filePath),
		locations: runtime_importedLocations(module, filePath),
		moduleID: description.moduleID ?? record.moduleID ?? null,
		currentWrapper: module,
		family: slothlet.instanceID,
		distance: 0,
		record
	};
	const { place } = createFramePlacer([entry]);
	const decide = (frames) => {
		let index = -1;
		// Whether the entry slothlet made for this flow itself was passed with no code of anyone's before it: the flow
		// was re-entered (the live runtime's pin) by code further out, which is then what is asked about.
		let passedOwnEntry = false;
		let passedCode = false;
		for (const frame of frames) {
			index++;
			if (frame.path.startsWith(FRAMEWORK_DIR + "/")) {
				if (frame.enter) {
					if (passedOwnEntry || passedCode) return null;
					passedOwnEntry = true;
				}
				continue;
			}
			passedCode = true;
			if (frame.async || isRunnerFrame(frame)) return null;
			if (frame.evaluated || isForeignScript(frame)) return UNACCOUNTED_SUPPLIER;
			// Node's own code acts for whoever called it: the next frame out decides.
			if (frame.path.startsWith("node:")) {
				if (runtime_isNodeScript(frame)) continue;
				return UNACCOUNTED_SUPPLIER;
			}
			const leaves = runtime_leavesAt(slothlet, frame);
			if (leaves.length) {
				if (!runtime_runsFileSource(frame) && !runtime_runsRunnerTransform(frame)) return UNACCOUNTED_SUPPLIER;
				const definers = runtime_narrowToLeaf(leaves, frame, runtime_framesAfter(frames, index));
				// Every leaf whose code is further out on the stack is a caller too: the code ran through them.
				const callers = runtime_outerCallers(frames, index, slothlet, true).filter((caller) => caller !== module && caller !== definers[0]);
				if (definers.length === 1 && definers[0] === module && !callers.length) return null;
				return { wrapper: definers[0], ceiling: combineCeilings(module, record.ceiling ?? null, ...definers.slice(1), ...callers) };
			}
			const placement = filePath ? place(frame) : null;
			if (placement?.matches.length) return null;
			if (!placement) return isNode ? runtime_packageAnswer(record, frame, false) : null;
			return UNACCOUNTED_SUPPLIER;
		}
		return frames.truncated ? undefined : null;
	};
	return decide(runtime_captureFrames(48)) ?? null;
}

/**
 * The definer of code a stand-in runs (#726), read from the stack: the innermost frame below slothlet's own, placed on
 * the leaf of its instance whose source range holds it, or on the file's module for code outside every export. That is
 * the definer wherever the frame names a file of the stand-in's instance; it runs under the stand-in's ceiling (whoever
 * runs it), never under the leaf the stand-in recorded, which is no caller of it. Where the frame names no such file
 * (evaluated code, a package's or the host's own, a frame past the stand-in's entry), the stack cannot tell, and the
 * stand-in's record is read as before.
 * @param {{wrapper: object, ceiling?: object|null}} record - The stand-in's call.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>|null}|null|undefined} The definer the stack names,
 *   null when it is the recorded one, or undefined when the stack cannot tell.
 * @private
 */
function runtime_madeCodeDefiner(record) {
	const recorded = record.wrapper;
	const frames = runtime_captureFrames(24);
	let index = -1;
	for (const frame of frames) {
		index++;
		if (frame.path.startsWith(FRAMEWORK_DIR + "/")) {
			if (frame.enter) return undefined;
			continue;
		}
		if (frame.async || isRunnerFrame(frame) || frame.evaluated || isForeignScript(frame)) return undefined;
		// Node's own code reads values for whoever called it: the next frame out decides.
		if (frame.path.startsWith("node:") && runtime_isNodeScript(frame)) continue;
		if (!runtime_runsFileSource(frame) && !runtime_runsRunnerTransform(frame)) return undefined;
		const leaves = runtime_leavesAt(recorded.slothlet, frame);
		if (!leaves.length) return undefined;
		const definers = runtime_narrowToLeaf(leaves, frame, runtime_framesAfter(frames, index));
		if (definers.includes(recorded)) return null;
		return { wrapper: definers[0], ceiling: combineCeilings(record.ceiling ?? null, ...definers.slice(1)) };
	}
	return undefined;
}

/**
 * The answer for code of a leaf's own file running inside its call that another export of the file wrote (#726): a
 * closure a sibling leaf returned, handed back in by the caller. Its definer is that sibling, under the leaf and the
 * calls that handed code down. Null when the code is the leaf's own: written inside its export, or outside every
 * export with the leaf's code (or none of the file's leaves) calling it.
 * @param {{wrapper: object, ceiling?: object|ReadonlyArray<object>|null}} record - The leaf's call.
 * @param {object} frame - The frame.
 * @param {Array<object>} outer - The frames further out, innermost first.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|null} The answer.
 * @private
 */
function runtime_siblingAuthor(record, frame, outer) {
	const leaf = record.wrapper;
	const leaves = runtime_leavesAt(leaf.slothlet, frame);
	if (leaves.length < 2 || !leaves.includes(leaf)) return null;
	const source = runtime_sourceOf(leaf.____slothletInternal.filePath, frame);
	if (!source) return null;
	// The nearest frame of the file inside an export names the code's leaf; the leaf's own module node holds none.
	let holder = runtime_leafHolding(leaves, source, frame);
	for (const further of holder ? [] : outer) {
		if (!runtime_sameFileFrame(further, frame)) break;
		if ((holder = runtime_leafHolding(leaves, source, further))) break;
	}
	if (!holder || holder === leaf) return null;
	// A leaf nested in the entered one (a member of a callable node) is the entered leaf's own code.
	const own = String(leaf.____slothletInternal.apiPath ?? "");
	if (String(holder.____slothletInternal.apiPath ?? "").startsWith(own + ".")) return null;
	return { wrapper: holder, ceiling: combineCeilings(leaf, record.ceiling, supplierChainCeiling(record)) };
}

/**
 * Whether a leaf is one the host added as an object or a function (`api.slothlet.api.add(path, { fn() {…} })`), which
 * has no file of its own (#717): it was built under the `synthetic:` sentinel, and host code made the `api.add` that
 * mounted it. A leaf a module's own `api.add` mounted the same way, and a node a module assigned (no file at all), are
 * not.
 * @param {object} leaf - The leaf's wrapper.
 * @param {string|null|undefined} filePath - Its recorded file.
 * @returns {boolean} True when the host added it as an object.
 * @private
 */
function runtime_isHostObjectLeaf(leaf, filePath) {
	if (typeof filePath !== "string" || !filePath.startsWith("synthetic:")) return false;
	const internal = leaf.____slothletInternal;
	const { ownership, apiManager } = leaf.slothlet.handlers;
	// A synthetic leaf always carries the moduleID of the add that built it, and its instance its handlers; the guard
	// covers a partial wrapper handed in by a direct caller.
	/* v8 ignore next */
	if (!internal?.moduleID || !ownership || !apiManager) return false;
	// The deepest of its module's mounts that holds it, and the mounter recorded for it: null for host code, the module's
	// id for a module's own add.
	const segments = internal.apiPath.split(".");
	const holds = (endpoint) =>
		endpoint
			.split(".")
			.filter(Boolean)
			.every((part, index) => segments[index] === part);
	const mount = ownership
		.getModuleMounts(internal.moduleID)
		.filter(holds)
		.sort((a, b) => b.length - a.length)[0];
	return mount !== undefined && apiManager.mountedBy.get(apiManager.mountKey(internal.moduleID, mount)) === null;
}

/**
 * Whether a frame no call can be placed on (the host's code, a package's), running inside a call of a leaf with no file,
 * is the leaf's own code (#717). The leaf is its own entity, so such code runs as the leaf: the host's helpers, and any
 * package's code, including a package a call up the chain imports too, or one its caller passed a function of in. A
 * frame is never placed on a leaf other than the one entered. A file no instance tags that a module's code loaded,
 * directly or through other such files (one reached through a package scope's `"imports"`, one a package's `import()`
 * loaded; see {@link runtime_packageImportingLeaves}), is that module's code, not the leaf's; a package's file is not
 * walked, so a package a module imports stays the leaf's code. Code that does not run its file's own
 * source (compiled under a name no file holds, or one holding another source), and a package whose loader is not known
 * (see {@link runtime_isUnownedPackage}), are no one's.
 * @param {{wrapper: object, parent: object|null}} record - The leaf's call.
 * @param {{path: string, line: string, hash: string|null, key: string|null}} frame - The frame.
 * @returns {boolean} True when it is the leaf's code, false when it is a module's or no one's.
 * @private
 */
function runtime_isFilelessLeafCode(record, frame) {
	const leaf = record.wrapper;
	if (runtime_isUnownedPackage(leaf, frame, true)) return false;
	if (!frame.path.includes("/node_modules/") && runtime_packageImportingLeaves(leaf.slothlet, frame.path).size) return false;
	return runtime_runsFileSource(frame) || runtime_runsOwnerTransform(leaf.slothlet, frame) || runtime_runsHostLoadedTransform(frame);
}

/**
 * Whether a package file no module is recorded to have loaded has no known owner, and so is refused as anyone's code
 * (#597, #714): one with no loader recorded at all, outside the package that created the instance. Inside a leaf with
 * no file it is the host's (#717) — slothlet's loader records every import a module makes — except inside a vitest
 * worker, whose module runner can load a module's packages itself, so that a module's own package cannot be told from
 * the host's there.
 * @param {object} leaf - The wrapper of the leaf whose call it runs in.
 * @param {{path: string}} frame - The package code's frame.
 * @param {boolean} fileless - Whether the leaf is one the host added as an object (see {@link runtime_isHostObjectLeaf}).
 * @returns {boolean} True when it has no known owner.
 * @private
 */
function runtime_isUnownedPackage(leaf, frame, fileless) {
	if (!frame.path.includes("/node_modules/") || isInstanceOwnerFile(leaf.slothlet, frame.path)) return false;
	return fileless ? Boolean(RUNNER_MODULES) : !runtime_fileImporters(frame.path).length;
}

/**
 * The most package files walked up from one, looking for the modules that import it.
 * @type {number}
 * @private
 */
const PACKAGE_WALK = 256;

/**
 * The files that import a file no instance tags (#714): those slothlet's resolve hook recorded under Node, and, where
 * vitest's runner evaluated the file, the modules its record of the file names as importers. Under vitest the modules
 * of an instance and their helpers can be loaded by vitest's runner rather than Node's loader (slothlet in
 * `server.deps.inline`), so Node's hook sees none of those imports.
 * @param {string} path - The file, in comparable form.
 * @returns {Array<string>} The importers' URLs or module ids.
 * @private
 */
function runtime_fileImporters(path) {
	const importers = packageImporters(path);
	// Plus the importers vitest's runner recorded before slothlet loaded (see RUNNER_SNAPSHOT): a record added later is
	// not read (#714).
	// And those the vite plugin recorded as it resolved the imports (#714).
	return [...importers, ...(RUNNER_SNAPSHOT.importers.get(path) ?? []), ...(VITE_LOADED_REGISTRY?.importersOf(path) ?? [])];
}

/**
 * The instance copies vitest's runner records as importing a file no instance tags, directly or through other untagged
 * files (#714): each with its instance, its mount and its location.
 * @param {string} path - The file, in comparable form.
 * @returns {Array<{family: string, mount: string|null, location: string}>} The copies.
 * @private
 */
function runtime_runnerTaggedImporters(path) {
	// Only the records that existed before slothlet loaded are walked (see RUNNER_SNAPSHOT) (#714).
	if (!RUNNER_MODULES) return [];
	const found = [];
	const seen = new Set([path]);
	const queue = [path];
	while (queue.length && seen.size <= PACKAGE_WALK) {
		for (const id of RUNNER_SNAPSHOT.importers.get(queue.shift()) ?? []) {
			if (typeof id !== "string") continue;
			const location = toComparablePath(id);
			const query = id.split("?")[1] ?? "";
			const family = queryParam(query, "slothlet_instance");
			if (family) found.push({ family, mount: queryParam(query, "module"), location });
			else if (!seen.has(location)) {
				seen.add(location);
				queue.push(location);
			}
		}
	}
	return found;
}

/**
 * The leaves of an instance whose code loaded a file no instance tags, directly or through other such files and the
 * module's own helper files, as the resolve hook recorded it (#597).
 * @param {object} slothlet - The instance.
 * @param {string} path - The package file, in comparable form.
 * @returns {Set<object>} The leaves.
 * @private
 */
function runtime_packageImportingLeaves(slothlet, path) {
	const family = slothlet.instanceID;
	const leaves = new Set();
	const graph = runtime_importGraph(family);
	const commonJS = runtime_commonJSLocations(family);
	const seen = new Set([path]);
	const queue = [path];
	// The instance's own files reached: each is a leaf's, or a helper of the leaves importing it.
	const reached = [];
	while (queue.length && seen.size <= PACKAGE_WALK) {
		for (const importer of runtime_fileImporters(queue.shift())) {
			const query = importer.split("?")[1] ?? "";
			const location = toComparablePath(importer);
			const instance = queryParam(query, "slothlet_instance");
			// A module's copy of any instance names the module's file: an untagged file is loaded once per process, by
			// whichever instance came first, and is the same module's code for every instance built from that file.
			if (instance) {
				reached.push({ location, mount: queryParam(query, "module") });
				continue;
			}
			if (commonJS.has(location) || LEAF_FILES.get(slothlet)?.has(location)) {
				reached.push({ location, mount: null });
				continue;
			}
			if (!seen.has(location)) {
				seen.add(location);
				queue.push(location);
			}
		}
	}
	for (const { location, mount } of reached) {
		const files = new Set([location]);
		const walk = [location];
		while (walk.length && files.size <= PACKAGE_WALK) {
			const file = walk.shift();
			const own = runtime_leavesAtFile(slothlet, file, family, mount);
			if (own.length) {
				for (const leaf of own) leaves.add(leaf);
				continue;
			}
			for (const importer of graph.get(file) ?? []) {
				if (!files.has(importer)) {
					files.add(importer);
					walk.push(importer);
				}
			}
		}
	}
	return leaves;
}

/**
 * The answer for the code of a file no instance tags — a package's, a file a module required by some path, the host's
 * own — running inside a call, under provenance (#597): the leaf's own when the leaf's code loaded the file, directly
 * or through other such files; otherwise the code of the leaves that did, under the call it runs inside (all of them
 * have to be allowed). A file no module loaded is the host's, and runs as the leaf, as before.
 * @param {{wrapper: object, ceiling?: object|ReadonlyArray<object>|null}} record - The call.
 * @param {{path: string, line: string}} frame - The package code's frame.
 * @param {boolean} fileless - Whether the leaf is one the host added as an object (see {@link runtime_isHostObjectLeaf}).
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|{unaccounted: true}|null} The answer.
 * @private
 */
function runtime_packageAnswer(record, frame, fileless) {
	const leaf = record.wrapper;
	// A leaf with no file is its own entity: a package's code inside it is the leaf's, whoever else imports it, and a file
	// a module loaded is that module's (#717).
	if (fileless) return runtime_isFilelessLeafCode(record, frame) ? null : UNACCOUNTED_SUPPLIER;
	const importers = runtime_packageImportingLeaves(leaf.slothlet, frame.path);
	// No module loaded it. A package file with no loader recorded at all (vite loaded the modules, or it was loaded
	// before slothlet) has no known owner and is refused, as a package can be anyone's code. Any other file is the host's
	// own only when the frame runs its own source: code compiled under a name no file holds, or holding another source
	// (`vm`, `Module#_compile`, a `data:` URL, a `vm.SourceTextModule` named after a file), is no one's.
	// The package that created the instance is the host's own, wherever it is installed (#714).
	if (!importers.size) {
		if (runtime_isUnownedPackage(leaf, frame, false)) return UNACCOUNTED_SUPPLIER;
		return runtime_runsFileSource(frame) || runtime_runsOwnerTransform(leaf.slothlet, frame) || runtime_runsHostLoadedTransform(frame)
			? null
			: UNACCOUNTED_SUPPLIER;
	}
	if (importers.has(leaf)) return null;
	for (const ceiling of ceilingMembers(record.ceiling)) if (importers.has(ceiling)) return null;
	const [first, ...rest] = importers;
	return { wrapper: first, ceiling: combineCeilings(leaf, record.ceiling, supplierChainCeiling(record), ...rest) };
}

/**
 * The root folder of the package that created each instance (#714): the nearest folder holding a `package.json` above
 * the file whose code called `slothlet()`, in comparable form. Held weakly by instance, out of every module's reach.
 * @type {WeakMap<object, string>}
 * @private
 */
const OWNER_PACKAGES = new WeakMap();

/**
 * slothlet's own package entry files (`index.mjs`, and `index.cjs` that loads it), beside its source or build folder:
 * the `slothlet()` a host imports from the package calls the one {@link recordInstanceOwner} is read in.
 * @type {Set<string>}
 * @private
 */
const PACKAGE_ENTRIES = new Set(
	["index.mjs", "index.cjs"].map((file) => `${FRAMEWORK_DIR.slice(0, FRAMEWORK_DIR.lastIndexOf("/"))}/${file}`)
);

/**
 * The package root of each file asked about, in comparable form (null when no folder above it holds a `package.json`).
 * @type {Map<string, string|null>}
 * @private
 */
const PACKAGE_ROOTS = new Map();

/**
 * The root folder of the package a file belongs to: the nearest folder above it holding a `package.json`.
 * @param {string} path - The file, in comparable form.
 * @returns {string|null} The folder, in comparable form, or null when there is none.
 * @private
 */
function runtime_packageRootOf(path) {
	if (PACKAGE_ROOTS.has(path)) return PACKAGE_ROOTS.get(path);
	let root = null;
	for (let dir = path.slice(0, path.lastIndexOf("/")); dir; dir = dir.slice(0, dir.lastIndexOf("/"))) {
		if (nodeFs(FS_EXISTS, `${dir}/package.json`)) {
			root = dir;
			break;
		}
	}
	if (PACKAGE_ROOTS.size >= 4096) PACKAGE_ROOTS.clear();
	PACKAGE_ROOTS.set(path, root);
	return root;
}

/**
 * Record which package created an instance (#714): the package of the innermost code on the stack that is neither
 * slothlet's nor Node's, read when `slothlet()` is called. A host installed as a package (rummage, under
 * `node_modules/@cldmv/rummage`) is loaded before slothlet, so slothlet's loader records no importer for its files; its
 * own files are the host's, and run inside a module's call as that call, as the host's files anywhere else do. Code
 * compiled under some location (`eval`, `vm`) names no package.
 * @param {object} slothlet - The new instance.
 * @returns {void}
 * @internal
 * @example
 * recordInstanceOwner(instance);
 */
export function recordInstanceOwner(slothlet) {
	if (!isNode) return;
	for (const frame of runtime_captureFrames(32)) {
		if (frame.path.startsWith(FRAMEWORK_DIR + "/") || frame.path.startsWith("node:") || PACKAGE_ENTRIES.has(frame.path)) continue;
		if (frame.evaluated) return;
		const root = runtime_packageRootOf(frame.path);
		if (root) OWNER_PACKAGES.set(slothlet, root);
		return;
	}
}

/**
 * Whether a file belongs to the package that created an instance (see {@link recordInstanceOwner}): its own nearest
 * package root is that package's, so a package installed inside the owner's folder is not the owner's.
 * @param {object} slothlet - The instance.
 * @param {string} path - The file, in comparable form.
 * @returns {boolean} True when it does.
 * @internal
 * @example
 * isInstanceOwnerFile(instance, "/app/node_modules/host/lib/context.mjs"); // true when host created the instance
 */
export function isInstanceOwnerFile(slothlet, path) {
	const owner = OWNER_PACKAGES.get(slothlet);
	return owner !== undefined && runtime_packageRootOf(path) === owner;
}

/**
 * The `name` in the `package.json` of each package root asked about (null when it cannot be read).
 * @type {Map<string, string|null>}
 * @private
 */
const PACKAGE_NAMES = new Map();

/**
 * The `name` a package root's `package.json` gives.
 * @param {string} root - The package root, in comparable form.
 * @returns {string|null} The name, or null.
 * @private
 */
function runtime_packageName(root) {
	if (!PACKAGE_NAMES.has(root)) {
		let name = null;
		try {
			const parsed = JSON_PARSE(nodeFs(FS_READ_FILE, `${root}/package.json`, "utf8"));
			if (typeof parsed?.name === "string") name = parsed.name;
		} catch {
			// A manifest that cannot be read or parsed names no package.
		}
		PACKAGE_NAMES.set(root, name);
	}
	return PACKAGE_NAMES.get(root);
}

/**
 * The packages whose code evaluates the modules vite transformed: vitest's module runner and vite's own.
 * @type {Set<string>}
 * @private
 */
const VITE_RUNNERS = new Set(["vitest", "vite"]);

/**
 * The `stack` getter V8 gives every error, to tell a genuine error's stack from one a script put on it.
 * @type {Function|undefined}
 * @private
 */
const PRISTINE_STACK_GET = Objects.getOwnPropertyDescriptor(new PristineError(), "stack")?.get;

/**
 * The frames slothlet itself read off a registration's error, so a stack anyone else produced is not taken for one.
 * @type {WeakSet<object>}
 * @private
 */
const READ_REGISTRATIONS = new WeakSet();

/**
 * The script a registration's error was created in, when the registration is genuine (#714): a native error whose
 * stack is still unread, created by a file's own top-level code — its first frame, compiled code with a script hash,
 * not code compiled from a string — that vitest's or vite's runner was evaluating: the next frame that is not Node's
 * own code is a file of the `vitest` or `vite` package running that file's own source. Code a module compiled with `vm` under a host file's name
 * and registered itself has its own frame, not the runner's, below it.
 * @param {unknown} entry - What was pushed.
 * @returns {{key: string, hash: string, location: string}|null} The script, with the location its frame names, or null.
 * @private
 */
function runtime_registeredScript(entry) {
	// An engine whose errors carry no `stack` getter cannot tell an unread stack from one a script wrote: nothing is taken.
	if (!PRISTINE_STACK_GET || !util.types.isNativeError(entry)) return null;
	if (Objects.getOwnPropertyDescriptor(entry, "stack")?.get !== PRISTINE_STACK_GET) return null;
	const previousPrepare = PristineError.prepareStackTrace;
	PristineError.prepareStackTrace = (error, sites) => {
		const frames = runtime_structuredFrames(error, sites);
		READ_REGISTRATIONS.add(frames);
		return frames;
	};
	let frames;
	try {
		frames = Reflect.apply(PRISTINE_STACK_GET, entry, []);
	} finally {
		PristineError.prepareStackTrace = previousPrepare;
	}
	if (!READ_REGISTRATIONS.has(frames)) return null;
	let own = null;
	let runner = null;
	for (const frame of frames) {
		if (!own) {
			own = frame;
			continue;
		}
		// Node's own code between them (the microtask queue a module resumes in after its imports) is passed over.
		if (frame.path.startsWith("node:") && !frame.evaluated && runtime_isNodeScript(frame)) continue;
		runner = frame;
		break;
	}
	if (!own?.hash || !own.key || own.evaluated || own.path.startsWith(FRAMEWORK_DIR + "/") || own.path.startsWith("node:")) return null;
	if (!runner?.hash || runner.evaluated || runner.path.startsWith("node:")) return null;
	const runnerRoot = runtime_packageRootOf(runner.path);
	if (!runnerRoot || !VITE_RUNNERS.has(runtime_packageName(runnerRoot)) || !runtime_runsFileSource(runner)) return null;
	return { key: own.key, hash: own.hash, location: own.location };
}

/**
 * The registrations of the host's own vite-transformed files (#714), kept on the global object under
 * {@link VITE_HOST_SCRIPTS}: the array a registration pushes onto, made by the first registration or by slothlet,
 * whichever runs first, and fixed in place by slothlet with a frozen `registered(key, hash)` reader. What was pushed
 * is read once, in order, and only what {@link runtime_registeredScript} accepts is kept; anything else is dropped.
 * @type {{registered: (key: string, hash: string) => boolean}|null}
 * @private
 */
const VITE_HOST_REGISTRY = isNode ? installViteHostRegistry(globalThis) : null;

/**
 * Fix the registry of {@link VITE_HOST_REGISTRY} on a global object (#714): take over what registrations already
 * pushed onto a plain array there, and put in its place, unchangeable, an array with a frozen `registered(key, hash)`
 * reader. A registry another copy of slothlet already fixed is used as it is.
 * @param {object} target - The global object.
 * @returns {{registered: (key: string, hash: string) => boolean}|null} The registry, or null when the one in place
 *   offers no reader.
 * @internal
 * @example
 * installViteHostRegistry(globalThis).registered(frame.key, frame.hash);
 */
export function installViteHostRegistry(target) {
	const key = Symbol.for(VITE_HOST_SCRIPTS);
	const current = Objects.getOwnPropertyDescriptor(target, key);
	// Fixed by another copy of slothlet already: its reader answers for every copy.
	if (current && !current.configurable) return typeof current.value?.registered === "function" ? current.value : null;
	const queue = [];
	// What registrations pushed before slothlet loaded; a Proxy in its place is not read, as reading it would run its traps.
	if (Arrays.isArray(current?.value) && !util.types.isProxy(current.value)) {
		for (let i = 0; i < current.value.length; i++) queue[queue.length] = Objects.getOwnPropertyDescriptor(current.value, i)?.value;
	}
	/** @type {Map<string, Set<string>>} */
	const scripts = new Map();
	const registered = (scriptKey, hash) => {
		const pending = queue.length;
		for (let i = 0; i < pending; i++) {
			const script = runtime_registeredScript(Objects.getOwnPropertyDescriptor(queue, i)?.value);
			if (!script) continue;
			let hashes = scripts.get(script.key);
			if (!hashes) scripts.set(script.key, (hashes = new Set()));
			hashes.add(script.hash);
		}
		// What was read is dropped; anything pushed while reading stays for the next read.
		queue.splice(0, pending);
		return scripts.get(scriptKey)?.has(hash) === true;
	};
	Objects.defineProperty(queue, "registered", {
		value: Objects.freeze(registered),
		enumerable: false,
		writable: false,
		configurable: false
	});
	Objects.defineProperty(target, key, { value: queue, enumerable: false, writable: false, configurable: false });
	return queue;
}

/**
 * Whether a frame of a file vite transformed runs that file's own code, as the registration the vite plugin appended
 * to it recorded (#714): the frame's script is one vitest's or vite's runner evaluated for the file, and the file is
 * one of the package that created the instance. A registered file of any other package is not taken for the host's.
 * @param {object} slothlet - The instance.
 * @param {{path: string, hash: string|null, key: string|null}} frame - The frame.
 * @returns {boolean} True when it does.
 * @private
 */
function runtime_runsViteHostSource(slothlet, frame) {
	return isInstanceOwnerFile(slothlet, frame.path) && runtime_runsRunnerTransform(frame);
}

/**
 * Whether a frame runs the code vitest's or vite's runner evaluated for its file, as the registration the vite plugin
 * appended to the file recorded (#714), whatever package the file is of: under vite, what a frame hashing as its file
 * on disk is under Node's own loader. Code compiled under the file's name from any other source runs in a script of its
 * own and is not.
 * @param {{hash: string|null, key: string|null, evaluated?: boolean}} frame - The frame.
 * @returns {boolean} True when it does.
 * @private
 */
function runtime_runsRunnerTransform(frame) {
	if (!VITE_HOST_REGISTRY || !frame.hash || !frame.key || frame.evaluated) return false;
	return VITE_HOST_REGISTRY.registered(frame.key, frame.hash);
}

/**
 * The record of who loaded a file vite transformed that a registration holds, when it is genuine (#714): an `Error`
 * {@link runtime_registeredScript} accepts, created by the top-level code of the virtual module the vite plugin writes
 * for the file (its location names the file, under an id with a leading `\0` that no file on disk has), frozen, its
 * message the JSON of the importers' ids. The plugin writes that module's code from the imports it resolved, so no
 * file's code can make such a record, and none can change one once made.
 * @param {unknown} entry - What was pushed.
 * @returns {{path: string, importers: Array<string>}|null} The file, in comparable form, and its importers, or null.
 * @private
 */
function runtime_loadedRecord(entry) {
	const script = runtime_registeredScript(entry);
	const prefix = `\0${LOADED_BY_SPECIFIER}`;
	if (typeof script?.location !== "string" || !script.location.startsWith(prefix) || !Objects.isFrozen(entry)) return null;
	const loaded = queryParam(script.location.slice(prefix.length), "id");
	const message = Objects.getOwnPropertyDescriptor(entry, "message");
	if (!loaded || typeof message?.value !== "string") return null;
	let importers;
	try {
		importers = JSON_PARSE(message.value);
	} catch {
		return null;
	}
	if (!Arrays.isArray(importers)) return null;
	return { path: toComparablePath(loaded), importers: importers.filter((id) => typeof id === "string") };
}

/**
 * Fix the registry of {@link VITE_LOADED_REGISTRY} on a global object (#714): read what records were already pushed
 * onto a plain array there, and put in its place, unchangeable, a frozen object whose `push` reads each record as it
 * comes and whose `importersOf(path)` gives the ids of the modules recorded as loading a file, or null when no record
 * of it was made. A registry another copy of slothlet already fixed is used as it is.
 * @param {object} target - The global object.
 * @returns {{importersOf: (path: string) => Array<string>|null}|null} The registry, or null when the one in place
 *   offers no reader.
 * @internal
 * @example
 * installViteLoadedRegistry(globalThis).importersOf("/app/exts/x/extension.mjs"); // [] when only the host loaded it
 */
export function installViteLoadedRegistry(target) {
	const key = Symbol.for(VITE_LOADED_BY);
	const current = Objects.getOwnPropertyDescriptor(target, key);
	// Fixed by another copy of slothlet already: its reader answers for every copy.
	if (current && !current.configurable) return typeof current.value?.importersOf === "function" ? current.value : null;
	/** @type {Map<string, Set<string>>} */
	const records = new Map();
	const take = (entry) => {
		const record = runtime_loadedRecord(entry);
		if (!record) return;
		let importers = records.get(record.path);
		if (!importers) records.set(record.path, (importers = new Set()));
		for (let i = 0; i < record.importers.length; i++) importers.add(record.importers[i]);
	};
	// What records were pushed before slothlet loaded; a Proxy in its place is not read, as reading it would run its traps.
	if (Arrays.isArray(current?.value) && !util.types.isProxy(current.value)) {
		for (let i = 0; i < current.value.length; i++) take(Objects.getOwnPropertyDescriptor(current.value, i)?.value);
	}
	const registry = Objects.freeze({
		push: Objects.freeze((...entries) => {
			for (let i = 0; i < entries.length; i++) take(entries[i]);
			return 0;
		}),
		importersOf: Objects.freeze((path) => {
			const found = records.get(path);
			return found ? setMembers(found) : null;
		})
	});
	Objects.defineProperty(target, key, { value: registry, enumerable: false, writable: false, configurable: false });
	return registry;
}

/**
 * Whether a frame of a file no module loaded runs the file's own code as vite transformed it (#714): its script is the
 * one vitest's or vite's runner evaluated for the file, and the vite plugin recorded who loaded the file, so the
 * importers frame placement walks are those it resolved. A file whose loading went unrecorded is not.
 * @param {{path: string, hash: string|null, key: string|null, evaluated?: boolean}} frame - The frame.
 * @returns {boolean} True when it does.
 * @private
 */
function runtime_runsHostLoadedTransform(frame) {
	return runtime_runsRunnerTransform(frame) && VITE_LOADED_REGISTRY?.importersOf(frame.path) != null;
}

/**
 * vitest's record of the modules its runner evaluated in this process (`__vitest_worker__.evaluatedModules`), as it was
 * when slothlet loaded, or null outside vitest.
 * @type {{fileToModulesMap?: Map<string, Set<object>>, idToModuleMap?: Map<string, object>}|null}
 * @private
 */
const RUNNER_MODULES = isNode ? (globalThis.__vitest_worker__?.evaluatedModules ?? null) : null;

/**
 * The parameters vitest's module runner compiles each module it transformed as an async function of: vite's SSR
 * bindings, then (vitest 4, and vitest 5 unless `injectCjsGlobals` is off) the CommonJS globals. The script V8 runs for a
 * module is `'use strict';async (<parameters>)=>{{<vite's code>\n}}`.
 * @type {ReadonlyArray<string>}
 * @private
 */
const RUNNER_PARAMETERS = Objects.freeze(
	[
		"__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__"
	].flatMap((ssr) => [ssr, `${ssr},__filename,__dirname,module,exports,require`])
);

/**
 * vitest's record of the modules its runner had evaluated when this module loaded, read once then and never again
 * (#714). A record is data any code in the process can add, so only the records that already existed before any module
 * of an instance could run are taken: one added later is not read. For each file, the script hashes its code compiles to
 * under the runner, and the ids of the modules that import it.
 * @type {{scripts: Map<string, Set<string>>, importers: Map<string, Array<string>>}}
 * @private
 */
const RUNNER_SNAPSHOT = runtime_snapshotRunner();

/**
 * The records of who loaded each file vite transformed (#714), kept on the global object under {@link VITE_LOADED_BY}:
 * read as each is pushed, so none waits where code could take it away, and only what {@link runtime_loadedRecord}
 * accepts is kept. Made after {@link RUNNER_SNAPSHOT}, which reading a record consults.
 * @type {{importersOf: (path: string) => Array<string>|null}|null}
 * @private
 */
const VITE_LOADED_REGISTRY = isNode ? installViteLoadedRegistry(globalThis) : null;

/**
 * Read {@link RUNNER_SNAPSHOT} from the runner's records as they stand now, through the methods captured at load.
 * @returns {{scripts: Map<string, Set<string>>, importers: Map<string, Array<string>>}} The snapshot.
 * @private
 */
function runtime_snapshotRunner() {
	const scripts = new Map();
	const importers = new Map();
	if (!RUNNER_MODULES || !NODE_CRYPTO) return { scripts, importers };
	for (const node of mapValues(RUNNER_MODULES.idToModuleMap)) {
		const file = typeof node?.file === "string" ? node.file : null;
		if (!file) continue;
		const path = toComparablePath(file);
		const code = node?.meta?.code;
		if (typeof code === "string") {
			let hashes = scripts.get(path);
			if (!hashes) scripts.set(path, (hashes = new Set()));
			for (const parameters of RUNNER_PARAMETERS) hashes.add(sha256(`'use strict';async (${parameters})=>{{${code}\n}}`));
		}
		const ids = setMembers(node?.importers).filter((id) => typeof id === "string");
		if (ids.length) importers.set(path, [...(importers.get(path) ?? []), ...ids]);
	}
	return { scripts, importers };
}

/**
 * Whether a frame of a file of the package that created the instance runs that file's own code as vite transformed it
 * (#714): its script is the one the `slothletInstanceImports()` plugin's registration recorded, or the one vitest's
 * runner compiles the code vite gave it for the file into. Code compiled under the file's name from any other source —
 * with `vm`, by a module — runs in a script of its own and is not.
 * @param {object} slothlet - The instance.
 * @param {{path: string, hash: string|null, key: string|null, evaluated?: boolean}} frame - The frame.
 * @returns {boolean} True when it does.
 * @private
 */
function runtime_runsOwnerTransform(slothlet, frame) {
	if (!frame.hash || frame.evaluated || !isInstanceOwnerFile(slothlet, frame.path)) return false;
	return runtime_runsViteHostSource(slothlet, frame);
}

/**
 * Whether the code at a frame runs inside a leaf's own exported function, entered as that function (#726): the frame,
 * or one of the frames of its file that called it, is the leaf's function itself, starting exactly where the leaf's
 * export is declared. A function written inside the export and run later (a closure it returned) has no such frame
 * under it: it starts somewhere else, and nothing of the leaf's is on the stack between it and whoever runs it.
 * Where the engine does not say where a frame's function starts, the answer is no.
 * @param {object} leaf - The leaf.
 * @param {{lineNumber?: number|null, columnNumber?: number|null, enclosingLine?: number|null, enclosingColumn?: number|null, path: string, line: string}} frame - The frame.
 * @param {Array<object>} outer - The frames further out, innermost first.
 * @returns {boolean} True when it was.
 * @private
 */
function runtime_enteredAsItself(leaf, frame, outer) {
	const filePath = leaf.____slothletInternal?.filePath;
	const source = filePath ? runtime_sourceOf(filePath, frame) : null;
	const range = source ? runtime_leafRange(leaf, source) : null;
	if (!range) return false;
	const starts = (candidate) =>
		Boolean(candidate.enclosingLine && candidate.enclosingColumn) &&
		(source.starts[candidate.enclosingLine - 1] ?? Infinity) + candidate.enclosingColumn - 1 === range[0];
	if (starts(frame)) return true;
	for (const candidate of outer) {
		if (!runtime_sameFileFrame(candidate, frame)) return false;
		if (starts(candidate)) return true;
	}
	return false;
}

/**
 * The answer for a leaf's own exported function that code entered as it is (handed out by a module, or imported by
 * another route), rather than through its api node (#726): it counts as a call of that node. Whoever runs it has to
 * be allowed to call the leaf, each of them, and the function then runs as the leaf, with the leaf's rights and no
 * one else's as its ceiling, as a call through the node does. A runner that may not call the leaf has the access
 * refused (see {@link REFUSED_SUPPLIER}).
 * @param {object} leaf - The leaf.
 * @param {Array<object|ReadonlyArray<object>|null|undefined>} running - The calls running it: wrappers and ceilings.
 * @returns {{wrapper: object, ceiling: null}|{unaccounted: true, refused: true}} The answer.
 * @private
 */
function runtime_leafCallAnswer(leaf, running) {
	const internal = leaf.____slothletInternal;
	const permissionManager = leaf.slothlet?.handlers?.permissionManager;
	const target = String(internal.apiPath ?? "");
	const context = leaf.slothlet?.contextManager?.tryGetContext?.()?.context ?? null;
	const runners = new Set();
	for (const part of running) for (const member of ceilingMembers(part)) if (member && member !== leaf) runners.add(member);
	for (const runner of runners) {
		if (!genuineWrappers.has(runner)) return REFUSED_SUPPLIER;
		const caller = String(runner.____slothletInternal.apiPath ?? "");
		const allowed = permissionManager?.enforceAccess?.(
			caller,
			target,
			runner.____slothletInternal.filePath ?? null,
			internal.filePath ?? null,
			context,
			null,
			{
				moduleCaller: true
			}
		);
		if (!allowed) return REFUSED_SUPPLIER;
	}
	return { wrapper: leaf, ceiling: null };
}

/**
 * What {@link resolveSupplier}'s chain walk answers when the code running is another leaf's, found by its file.
 * @type {symbol}
 * @private
 */
const AUTHORED = Symbol("authored");

/**
 * The answer for code of the instance running inside a call that no call of it accounts for (#597): the leaf its file
 * was built for, under the call it runs inside and whatever that call runs under — with several leaves built from the
 * file, all of them. Null when no leaf was built from the file, or the frame does not run the file's own source.
 * @param {{wrapper: object, ceiling?: object|ReadonlyArray<object>|null}} record - The call the code runs inside.
 * @param {{path: string, line: string}} frame - The code's frame.
 * @param {Iterable<object>} [outer] - The frames further out, innermost first.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|null} The answer.
 * @private
 */
function runtime_authorAnswer(record, frame, outer = []) {
	// Only a file's own source is its author's: code compiled under its name by someone is no one's (#597). Under vite, the
	// code its runner evaluated for the file (#714).
	if (!runtime_runsFileSource(frame) && !runtime_runsRunnerTransform(frame)) return null;
	// The nearest leaf frame of the file, or the file's module when no frame of it is inside a leaf's range (#726).
	const further = Arrays.isArray(outer) ? outer : Arrays.from(outer);
	const authors = runtime_narrowToLeaf(runtime_leavesAt(record.wrapper.slothlet, frame), frame, further);
	if (!authors.length) return null;
	// A leaf's own exported function, entered as it is: a call of that leaf's node by whoever runs it.
	if (authors.length === 1 && runtime_enteredAsItself(authors[0], frame, further))
		return runtime_leafCallAnswer(authors[0], [record.wrapper, record.ceiling, supplierChainCeiling(record)]);
	// Inside a call that was handed code, the calls that handed it down are held to as well (see supplierChainCeiling).
	return {
		wrapper: authors[0],
		ceiling: combineCeilings(record.wrapper, record.ceiling, supplierChainCeiling(record), ...authors.slice(1))
	};
}

/**
 * Each source's text and line starts, made once (see {@link runtime_sourceOf}): by script key and hash for a source the
 * loader recorded, by file path for one read another way.
 * @type {Map<string, {text: string, starts: number[], names: Map<string, Set<string>>|null}|null>}
 * @private
 */
const FILE_SOURCES = new Map();

/**
 * Each leaf's source range in a source, as `[start, end)` offsets, or null (see {@link runtime_leafRange}): the last
 * source it was asked for.
 * @type {WeakMap<object, {source: object, range: number[]|null}>}
 * @private
 */
const LEAF_RANGES = new WeakMap();

/**
 * A text with its line starts.
 * @param {string} text - The text.
 * @returns {{text: string, starts: number[], names: null}} The source.
 * @private
 */
function runtime_asSource(text) {
	const starts = [0];
	for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
	return { text, starts, names: null };
}

/**
 * The source a frame's code was compiled from, with its line starts: what the frame's line and column, and the text of
 * the functions written in it, are positions in.
 *
 * It is the text slothlet's load hook recorded when the engine was given the file (TypeScript with its types
 * stripped), found by the frame's script key and hash, so it is the source of exactly the script the frame runs in:
 * a file changed on disk since, or loaded again with other content, does not move anything. Where the hook recorded
 * nothing, under vite's module runner it is the code the runner was given for the file, and otherwise (a loader
 * slothlet's hook does not see, an engine that reports no script hash) the file as it is on disk now.
 * @param {string} filePath - The file.
 * @param {{key?: string|null, hash?: string|null}|null} [frame=null] - A frame of the file.
 * @returns {{text: string, starts: number[], names: Map<string, Set<string>>|null}|null} The source, or null when it
 *   cannot be read.
 * @private
 */
function runtime_sourceOf(filePath, frame = null) {
	if (frame?.key) {
		const scriptID = `${frame.key}\u0000${frame.hash ?? ""}`;
		const known = FILE_SOURCES.get(scriptID);
		if (known) return known;
		const recorded = loadedScriptText(frame.key, frame.hash ?? null);
		if (typeof recorded === "string") {
			const source = runtime_asSource(recorded);
			if (FILE_SOURCES.size >= 4096) FILE_SOURCES.clear();
			FILE_SOURCES.set(scriptID, source);
			return source;
		}
	}
	if (FILE_SOURCES.has(filePath)) return FILE_SOURCES.get(filePath);
	let source;
	try {
		// Under vite's module runner the file runs as the code vite transformed it into: its frames and its functions'
		// text are that code's, so the code is what ranges are read from (the runner's wrapper only prefixes line 1).
		let runnerCode = null;
		if (RUNNER_MODULES) {
			const comparable = toComparablePath(filePath);
			for (const node of mapValues(RUNNER_MODULES.idToModuleMap)) {
				if (typeof node?.file === "string" && typeof node?.meta?.code === "string" && toComparablePath(node.file) === comparable) {
					runnerCode = node.meta.code;
					break;
				}
			}
		}
		source = runtime_asSource(
			runnerCode ?? String(nodeFs(FS_READ_FILE, filePath.startsWith("file:") ? new URL(filePath) : filePath, "utf8"))
		);
	} catch {
		// A file that cannot be read gives no ranges: its code is the file's module.
		source = null;
	}
	FILE_SOURCES.set(filePath, source);
	return source;
}

/**
 * An identifier as a pattern piece.
 * @type {string}
 * @private
 */
const IDENTIFIER = "[A-Za-z_$][\\w$]*";

/**
 * The names each export of a source is declared under in it, besides its own: the local a list names
 * (`export { t as a }`, a minifier's `export{t as a}`), the identifier `export default` or `module.exports =` is
 * given, the one `exports.a =` is assigned, and the ones a `module.exports = { a: t }` literal lists. Read from the
 * text by pattern, once per source; it only ever helps pick between places that hold the same function text.
 * @param {{text: string, names: Map<string, Set<string>>|null}} source - The source.
 * @returns {Map<string, Set<string>>} Export name to local names.
 * @private
 */
function runtime_exportLocals(source) {
	if (source.names) return source.names;
	const names = new Map();
	const add = (exported, local) => {
		if (!exported || !local) return;
		let held = names.get(exported);
		if (!held) names.set(exported, (held = new Set()));
		held.add(local);
	};
	const { text } = source;
	const entry = new RegExp(`^\\s*(${IDENTIFIER})(?:\\s+as\\s+(${IDENTIFIER}|"[^"]*"|'[^']*'))?\\s*$`);
	for (const list of text.matchAll(/export\s*\{([^}]*)\}/g)) {
		for (const part of list[1].split(",")) {
			const named = entry.exec(part);
			if (named) add((named[2] ?? named[1]).replace(/^["']|["']$/g, ""), named[1]);
		}
	}
	for (const given of text.matchAll(new RegExp(`export\\s+default\\s+(${IDENTIFIER})\\s*(?:;|$)`, "gm"))) add("default", given[1]);
	for (const given of text.matchAll(new RegExp(`module\\.exports\\s*=\\s*(${IDENTIFIER})\\s*(?:;|$)`, "gm"))) add("default", given[1]);
	for (const given of text.matchAll(new RegExp(`(?:module\\.)?exports\\.(${IDENTIFIER})\\s*=\\s*(${IDENTIFIER})\\s*(?:;|$)`, "gm")))
		add(given[1], given[2]);
	const pair = new RegExp(`^\\s*(${IDENTIFIER})(?:\\s*:\\s*(${IDENTIFIER}))?\\s*$`);
	for (const literal of text.matchAll(/module\.exports\s*=\s*\{([^{}]*)\}/g)) {
		for (const part of literal[1].split(",")) {
			const named = pair.exec(part);
			if (named) add(named[1], named[2] ?? named[1]);
		}
	}
	source.names = names;
	return names;
}

/**
 * Whether the function text at an offset of a source is where one of some names is declared: assigned or given as a
 * property (`export const a =`, `exports.a =`, `a:`), named by the text itself (`function a(`, `class a`, a method
 * `a(`), or, for a default export, what `export default` or `module.exports =` is given.
 * @param {string} text - The source's text.
 * @param {number} at - Where the function's text starts.
 * @param {string} own - The function's text.
 * @param {Set<string>} names - The names it may be declared under.
 * @returns {boolean} True when it is.
 * @private
 */
function runtime_declaredAt(text, at, own, names) {
	// What precedes the function, less any parentheses it is wrapped in.
	const before = text.slice(Math.max(0, at - 160), at).replace(/[\s(]+$/, "");
	for (const name of names) {
		if (name === "default" && /(?:export\s+default|module\.exports\s*=)$/.test(before)) return true;
		const escaped = name.replace(/\$/g, "\\$");
		if (new RegExp(`(?:^|[^\\w$])${escaped}\\s*[=:]$`).test(before)) return true;
		if (new RegExp(`^(?:async\\s+)?function\\s*\\*?\\s*${escaped}(?![\\w$])`).test(own)) return true;
		if (new RegExp(`^class\\s+${escaped}(?![\\w$])`).test(own)) return true;
		if (new RegExp(`^(?:static\\s+)?(?:async\\s+)?(?:get\\s+|set\\s+)?\\*?\\s*${escaped}\\s*\\(`).test(own)) return true;
	}
	return false;
}

/**
 * The source range of a leaf's function in a source: where the leaf's export is declared in it (#726). The function's
 * own text says how long it is; its export's declaration says which place in the source holds it. A place counts when
 * the text sits where the export's name is declared: `export const a = …`, `export function a`, `export class a`,
 * `export default …`, the local a list names (`export { t as a }`), `exports.a = …`, or a member of an exported object
 * or `module.exports = { a }`. With no declaration recognised, the one place the source holds the text is taken. Null
 * for a leaf that is not a function, whose text the source does not hold (a bound or native function, one made at
 * runtime), or when more than one place qualifies: the file's module then stands for its code.
 * @param {object} leaf - A leaf wrapper.
 * @param {{text: string, starts: number[], names: Map<string, Set<string>>|null}} source - The source of the script
 *   its code runs in.
 * @returns {number[]|null} `[start, end)`.
 * @private
 */
function runtime_leafRange(leaf, source) {
	const held = LEAF_RANGES.get(leaf);
	if (held && held.source === source) return held.range;
	let range = null;
	const impl = leaf.____slothletInternal?.impl;
	if (typeof impl === "function") {
		try {
			const own = functionSource(impl);
			if (!own.endsWith("{ [native code] }")) {
				const places = [];
				for (let at = source.text.indexOf(own); at !== -1 && places.length < 64; at = source.text.indexOf(own, at + 1)) places.push(at);
				if (places.length) {
					const exportPath = leaf.____slothletInternal.exportPath;
					const exported = Arrays.isArray(exportPath) && exportPath.length ? String(exportPath[exportPath.length - 1]) : null;
					const names = new Set(exported === null ? [] : [exported, ...(runtime_exportLocals(source).get(exported) ?? [])]);
					const declared = names.size ? places.filter((at) => runtime_declaredAt(source.text, at, own, names)) : [];
					if (declared.length === 1) range = [declared[0], declared[0] + own.length];
					else if (!declared.length && places.length === 1) range = [places[0], places[0] + own.length];
				}
			}
		} catch {
			range = null;
		}
	}
	LEAF_RANGES.set(leaf, { source, range });
	return range;
}

/**
 * How the node at an api path of an instance is found (see {@link setModuleNodeResolver}). Until the wrapper module
 * registers it, no node is found.
 * @type {function(object, string): (object|null)}
 * @private
 */
let moduleNodeResolver = () => null;

/**
 * Register how the node at an api path is found: the file's module node of a lazy tree, built with no file of its own,
 * is looked up by its path (#726).
 * @param {function(object, string): (object|null)} resolver - Takes an instance and an api path; returns its node's
 *   wrapper, or null.
 * @returns {void}
 * @internal
 */
export function setModuleNodeResolver(resolver) {
	moduleNodeResolver = resolver;
}

/**
 * The api path of the module a file's leaves were built from: each leaf's path less its path inside the file's
 * exports, when they all agree (#726). Null when they do not, or when it is the root.
 * @param {Array<object>} leaves - The leaves of one file.
 * @returns {string|null} The module path.
 * @private
 */
function runtime_moduleRootPath(leaves) {
	let root = null;
	for (const leaf of leaves) {
		const internal = leaf.____slothletInternal;
		const exportPath = internal.exportPath;
		if (!Arrays.isArray(exportPath) || !exportPath.length) continue;
		const segments = String(internal.apiPath ?? "").split(".");
		if (segments.length <= exportPath.length) return null;
		const path = segments.slice(0, segments.length - exportPath.length).join(".");
		if (root !== null && root !== path) return null;
		root = path;
	}
	return root;
}

/**
 * The leaf whose source range holds a frame of its file: the innermost such range. Null when no leaf's does.
 * @param {Array<object>} leaves - The leaves of the frame's file.
 * @param {{text: string, starts: number[]}} source - The file's source.
 * @param {{lineNumber?: number|null, columnNumber?: number|null}} frame - The frame.
 * @returns {object|null} The leaf.
 * @private
 */
function runtime_leafHolding(leaves, source, frame) {
	if (!frame?.lineNumber || !frame.columnNumber) return null;
	const offset = (source.starts[frame.lineNumber - 1] ?? Infinity) + frame.columnNumber - 1;
	let best = null;
	let bestLength = Infinity;
	for (const leaf of leaves) {
		const range = runtime_leafRange(leaf, source);
		if (range && range[0] <= offset && offset < range[1] && range[1] - range[0] < bestLength) {
			best = leaf;
			bestLength = range[1] - range[0];
		}
	}
	return best;
}

/**
 * Whether a frame runs code of the same file, instance and mount as another: a frame further out that does is still
 * that file's code calling it.
 * @param {{path: string, line: string, async?: boolean, evaluated?: boolean}} frame - The frame further out.
 * @param {{path: string, line: string}} inner - The frame it is compared with.
 * @returns {boolean} True when it does.
 * @private
 */
function runtime_sameFileFrame(frame, inner) {
	return (
		!frame.async &&
		!frame.evaluated &&
		frame.path === inner.path &&
		runtime_frameInstanceTag(frame.line) === runtime_frameInstanceTag(inner.line) &&
		runtime_frameModuleTag(frame.line) === runtime_frameModuleTag(inner.line)
	);
}

/**
 * The frames of a capture after the one at an index, read again from the capture as they are asked for.
 * @param {Iterable<object>} frames - The capture.
 * @param {number} index - The index of the frame they follow.
 * @returns {Iterable<object>} The frames further out.
 * @private
 */
function* runtime_framesAfter(frames, index) {
	let i = 0;
	for (const frame of frames) if (i++ > index) yield frame;
}

/**
 * The definer of code a frame runs in a file several leaves were built from (#726): the nearest leaf on the stack.
 * Walking out from the frame through the frames of the same file that called it, the first one inside a leaf's source
 * range names that leaf (the innermost such range): a helper outside every export, called from a leaf's code, runs as
 * that leaf. A frame of another file ends the walk. Only when no frame of the file is inside any leaf's range is the
 * code the module's: the file's own node, whose path every leaf's starts with. A lazy tree builds that node with no file
 * of its own, so it is found by its path, the leaves' paths less their paths inside the file's exports. With no such
 * node, every leaf comes back.
 * @param {Array<object>} leaves - The leaves of the frame's file.
 * @param {{path: string, line: string, lineNumber?: number|null, columnNumber?: number|null}} frame - The frame.
 * @param {Iterable<object>} [outer] - The frames further out, innermost first.
 * @returns {Array<object>} The one leaf, or every leaf.
 * @private
 */
function runtime_narrowToLeaf(leaves, frame, outer = []) {
	if (leaves.length < 2 || !frame?.lineNumber || !frame.columnNumber) return leaves;
	const filePath = leaves.find((leaf) => leaf.____slothletInternal.filePath)?.____slothletInternal.filePath;
	const source = filePath ? runtime_sourceOf(filePath, frame) : null;
	if (!source) return leaves;
	let best = runtime_leafHolding(leaves, source, frame);
	if (!best) {
		for (const further of outer) {
			if (!runtime_sameFileFrame(further, frame)) break;
			if ((best = runtime_leafHolding(leaves, source, further))) break;
		}
	}
	if (best) return [best];
	return runtime_fileModuleOf(leaves);
}

/**
 * The module of a file several leaves were built from (#726): the file's own node, whose path every leaf's starts with.
 * A lazy tree builds that node with no file of its own, so it is found by its path, the leaves' paths less their paths
 * inside the file's exports. With no such node, every leaf comes back.
 * @param {Array<object>} leaves - The leaves of one file.
 * @returns {Array<object>} The module's node alone, or every leaf.
 * @private
 */
function runtime_fileModuleOf(leaves) {
	if (leaves.length < 2) return leaves;
	// Code outside every leaf's range is the module's: the file's module node, whose path every leaf's starts with.
	const paths = leaves.map((leaf) => String(leaf.____slothletInternal.apiPath ?? ""));
	const module = leaves.find((leaf, i) => paths.every((other) => other === paths[i] || other.startsWith(paths[i] + ".")));
	if (module) return [module];
	// A lazy tree's module node was built with no file: found by its path, the same node an eager tree builds for the file.
	const modulePath = runtime_moduleRootPath(leaves);
	if (modulePath === null || !paths.every((path) => path.startsWith(modulePath + "."))) return leaves;
	const node = moduleNodeResolver(leaves[0].slothlet, modulePath);
	const standing = node && genuineWrappers.has(node) && node.slothlet === leaves[0].slothlet;
	return standing && (!runtime_isGone(node) || !runtime_checksPermissions(node.slothlet)) ? [node] : leaves;
}

/**
 * What a file's top level runs as (#726): made when slothlet loads the file, and read whenever something the file
 * started while it loaded (a timer, a listener, a queue, an async resource) runs later. The identity is the file's
 * module, the node code outside every export of the file runs as, found when it is asked for: the node does not exist
 * yet while the file loads, and a reload or a removal changes it afterwards. While it cannot be found (the file is
 * still loading, its node is gone, its instance has shut down) there is no identity, and the code is refused as code
 * no one accounts for.
 * @param {object} slothlet - The instance loading the file.
 * @param {string} filePath - The file.
 * @param {string|null|undefined} moduleID - The mount the file is loaded for.
 * @returns {{slothlet: object, filePath: string, moduleID: string|null, instanceID: function(): (string|null), wrapper: function(): (object|null), record: function(): (object|null)}} The load.
 * @internal
 * @example
 * const loading = createModuleLoad(slothlet, "/app/api/sync.mjs", null);
 * loading.wrapper(); // null while the file loads, then the node at `sync`
 */
export function createModuleLoad(slothlet, filePath, moduleID) {
	let record = null;
	const loading = {
		slothlet,
		filePath,
		moduleID: moduleID ?? null,
		// The context the instance runs in now: a reload moves it to a new ID.
		instanceID() {
			const instances = slothlet?.contextManager?.instances;
			if (!instances?.has) return null;
			for (let id = slothlet.instanceID; id;) {
				if (instances.has(id)) return id;
				const reloaded = id.lastIndexOf("_reload_");
				id = reloaded > 0 ? id.slice(0, reloaded) : null;
			}
			return null;
		},
		wrapper() {
			if (typeof filePath !== "string" || !runtime_instanceRuns(slothlet)) return null;
			const leaves = runtime_leavesAtFile(slothlet, toComparablePath(filePath), null, moduleID || null);
			if (!leaves.length) return null;
			const narrowed = runtime_fileModuleOf(leaves);
			return narrowed.length === 1 ? narrowed[0] : null;
		},
		// The call record the load's code runs under: kept while the module stays the same node.
		record() {
			const wrapper = loading.wrapper();
			if (!wrapper) return null;
			if (record?.wrapper !== wrapper)
				record = { wrapper, parent: null, flagged: false, ceiling: null, topLevel: true, file: filePath, moduleID: moduleID ?? null };
			return record;
		}
	};
	return loading;
}

/**
 * The load a stack's innermost code belongs to, among files being loaded (#726): the code registering something
 * while its file loads, for a runtime with no async store to carry the load (the live runtime). The innermost frame
 * that is neither slothlet's nor Node's decides: a frame in a loading file is that load's; a frame of another file of
 * a loading instance (a helper the file imports, evaluated as part of the load) is the load's when one load of that
 * instance is pending, or one alone imports the file. `false` when the code is a loading instance's and which load
 * cannot be told; null when it is not a loading file's code.
 * @param {Iterable<{slothlet: object, filePath: string, moduleID: string|null}>} loads - The loads pending.
 * @returns {object|false|null} The load, false, or null.
 * @internal
 * @example
 * const loading = loadOnStack(pending); // the load whose file's top level is registering a timer
 */
export function loadOnStack(loads) {
	for (const frame of runtime_captureFrames(32)) {
		if (frame.path.startsWith(FRAMEWORK_DIR + "/")) {
			// A call slothlet entered is running: its code is the call's, not a load's.
			if (frame.enter) return null;
			continue;
		}
		if (frame.path.startsWith("node:")) continue;
		if (frame.evaluated) return null;
		const tag = runtime_frameInstanceTag(frame.line);
		const mount = runtime_frameModuleTag(frame.line);
		const sameInstance = [];
		for (const loading of loads) {
			const family = loading.slothlet?.instanceID;
			if (tag && family !== tag) continue;
			if (toComparablePath(loading.filePath) === frame.path || runtime_realComparablePath(loading.filePath) === frame.path) {
				if (!mount || !loading.moduleID || loading.moduleID === mount) return loading;
				continue;
			}
			if (tag) sameInstance.push(loading);
		}
		if (!sameInstance.length) return null;
		if (sameInstance.length === 1) return sameInstance[0];
		// A helper several loads may be evaluating: the load whose file imports it, when one alone does.
		const graph = runtime_importGraph(tag);
		const seen = new Set([frame.path]);
		const queue = [frame.path];
		while (queue.length && seen.size <= PACKAGE_WALK) {
			for (const importer of graph.get(queue.pop()) ?? []) {
				if (seen.has(importer)) continue;
				seen.add(importer);
				queue.push(importer);
			}
		}
		const importing = sameInstance.filter((loading) => seen.has(toComparablePath(loading.filePath)));
		return importing.length === 1 ? importing[0] : false;
	}
	return null;
}

/**
 * Whether a node is gone from its tree: removed, or invalidated by a removal or a reload (#625).
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True when it is.
 * @private
 */
function runtime_isGone(wrapper) {
	const internal = wrapper.____slothletInternal;
	return Boolean(internal.invalid || internal.removed === true || internal.filePath === null);
}

/**
 * Whether an instance's permission system is on: only then does what a removed node or a shut-down instance made lose
 * its standing. With it off nothing is checked, and code runs as plain JavaScript (#726).
 * @param {object|null|undefined} slothlet - The instance.
 * @returns {boolean} True while it is on.
 * @private
 */
function runtime_checksPermissions(slothlet) {
	return slothlet?.handlers?.permissionManager?.isEnabled?.() === true;
}

/**
 * The ceiling code entered on its definer's behalf (a handed-out function, an instance method) runs under (#726): the
 * caller running it, read now — its executing module and that module's own ceiling — or none for the host. Entering
 * code as its definer never grants the definer's rights to whoever runs it: both have to allow every access.
 * @param {object} contextManager - The instance's context manager.
 * @param {string} instanceID - The instance.
 * @param {object|null} [slothlet=null] - The instance, to read the callers from the stack when no call names one.
 * @returns {object|ReadonlyArray<object>|null} The ceiling.
 * @throws {SlothletError} PERMISSION_DENIED when who is running the code cannot be told while the permission system is on.
 * @internal
 */
export function outerCallerCeiling(contextManager, instanceID, slothlet = null) {
	const identity = contextManager?.getCallerIdentity?.(instanceID);
	if (!identity?.currentWrapper) {
		// Who runs it cannot be told (several calls are waiting and the stack names more than one, or none): it is no
		// one's, and not the host's either, so the code is not run under its definer's rights alone.
		if (identity?.unresolved && slothlet && runtime_checksPermissions(slothlet))
			throw new SlothletError("PERMISSION_DENIED", { caller: null, target: "self" }, null, { validationError: true });
		// No call says who runs it: the leaves whose code is on the stack do (a module running the code from a timer it
		// reached without slothlet's store or pin). Only read where the frames are (`provenance`), and never inside a
		// flow slothlet pinned to the host.
		if (identity?.unresolved || !slothlet || !runtime_guardsForeignCode({ wrapper: { slothlet } })) return null;
		if (typeof contextManager.isAmbient === "function" && !contextManager.isAmbient(instanceID)) return null;
		const callers = runtime_outerCallers(runtime_captureFrames(32), -1, slothlet);
		return callers.length ? combineCeilings(...callers) : null;
	}
	// Run inside a call that was handed code, it may be code the caller handed in: the calls that handed code down are
	// its ceiling too (see supplierChainCeiling).
	return combineCeilings(identity.currentWrapper, identity.ceiling ?? null, supplierChainCeiling(identity.record));
}

/**
 * Whether what a module hands out and is handed is set up as that module's code (#597, #726): only while the
 * permission system of the wrapper's instance is on and `permissions.attribution` is `"precise"` (the default). Then a
 * value that is itself code (a function, a class, a class instance, a generator, a promise, a Proxy export) is a
 * stand-in recording the module as its definer; plain data passes as itself unsearched, and code nested in it is told
 * by its frames when it runs. With `"fast"`, or with the permission system not on (no `permissions` config,
 * `mode: "off"`, `enabled: false` or `mode: "disabled"`), nothing is wrapped and frames tell every definer.
 * @param {object|null|undefined} wrapper - A wrapper of the module.
 * @returns {boolean} True while code is handed out as stand-ins.
 * @internal
 */
export function handsOutAsModule(wrapper) {
	const slothlet = wrapper?.slothlet;
	return slothlet?.config?.permissions?.attribution !== "fast" && slothlet?.handlers?.permissionManager?.isEnabled?.() === true;
}

/**
 * Whether a module call's result is passed through {@link attributeResult} (#726): while the permission system of the
 * wrapper's instance is on, under either `permissions.attribution`. `"precise"` hands out code as stand-ins there;
 * `"fast"` hands back only a node's own Proxy export as the node's member.
 * @param {object|null|undefined} wrapper - A wrapper of the module.
 * @returns {boolean} True while results are attributed.
 * @internal
 */
export function attributesResults(wrapper) {
	return wrapper?.slothlet?.handlers?.permissionManager?.isEnabled?.() === true;
}

/**
 * The live instances by ID, filled as leaves register their files: where code running while no call does is looked
 * for (see {@link frameDefiner}).
 * @type {Map<string, WeakRef<object>>}
 * @private
 */
const LIVE_INSTANCES = new Map();

/**
 * Whether an instance still has a context its code can run in: it is not shut down. While a reload has moved it to an
 * ID whose context is not set up yet, the one it is reloading from counts.
 * @param {object} slothlet - The instance.
 * @returns {boolean} True while it runs.
 * @private
 */
function runtime_instanceRuns(slothlet) {
	const instances = slothlet?.contextManager?.instances;
	if (!instances?.has) return false;
	for (let id = slothlet.instanceID; id;) {
		if (instances.has(id)) return true;
		const reloaded = id.lastIndexOf("_reload_");
		id = reloaded > 0 ? id.slice(0, reloaded) : null;
	}
	return false;
}

/**
 * The leaves whose file a location is, across the instances, narrowed by the instance and mount tags the location
 * carries. While an instance's permission system is on, a shut-down instance and a removed node are skipped: what they
 * made has no standing. With it off they are not: nothing is checked (#726). Null when
 * none match, or when leaves of more than one running instance do (a file two instances load without a tag telling them
 * apart). The copy an instance that has shut down left behind is read only when no running instance holds the file.
 * A file several running instances hold is the one's whose flow is running, when something says which that is.
 * @param {string} path - Comparable path.
 * @param {string} line - Raw text holding the location's tags.
 * @param {string|null} [running=null] - The instance whose flow is running, when one is.
 * @returns {Array<object>|null} Leaves of one instance.
 * @private
 */
function runtime_leavesAtLocation(path, line, running = null) {
	const tag = runtime_frameInstanceTag(line);
	const mount = runtime_frameModuleTag(line);
	let found = null;
	let instance = null;
	// What an instance that has shut down left behind: read only when no running instance holds the file.
	let gone = null;
	let goneInstance = null;
	// Whether more than one running instance holds the file: only the one whose flow is running is then read.
	let several = false;
	for (const [id, reference] of LIVE_INSTANCES) {
		if (tag && id !== tag) continue;
		const slothlet = reference.deref();
		if (!slothlet) {
			LIVE_INSTANCES.delete(id);
			continue;
		}
		// What a shut-down instance made has no standing while its permission system was on; with it off the code is
		// still told apart, and runs as plain JavaScript, with no context to read `self` from (#726).
		const runs = runtime_instanceRuns(slothlet);
		if (!runs && runtime_checksPermissions(slothlet)) continue;
		const leaves = runtime_leavesAtFile(slothlet, path, tag, mount);
		if (!leaves.length) continue;
		if (!runs) {
			// A file no tag tells apart (a CommonJS file) that a running instance loads is that instance's: the copy an
			// instance that has shut down left behind does not stand beside it.
			if (goneInstance && goneInstance !== slothlet) gone = null;
			else gone = leaves;
			goneInstance ??= slothlet;
			continue;
		}
		// Leaves of a second running instance: the frame carries no tag to tell them apart. The instance whose flow is
		// running holds the code that is running; with nothing naming one, the code cannot be placed.
		if (instance && instance !== slothlet) {
			if (running === null) return null;
			several = true;
			if (id !== running) continue;
		}
		instance = slothlet;
		found = leaves;
	}
	if (several && instance.instanceID !== running) return null;
	return found ?? gone;
}

/**
 * The definer of the code doing an access while no call runs (the host running code a module handed out, #726): the
 * innermost frame below slothlet's own, placed on the leaf whose source range holds it, or on the file's module for
 * code outside every leaf's range. `null` when that frame is the host's (no running instance's file holds it);
 * `{ unplaced }` when it is code whose definer the frames cannot tell — evaluated or foreign-script code, or a file of
 * more than one instance — and `{ leaves }` when several leaves stand for it and none is the file's module (code
 * outside every export, in a tree where no node was built for the file itself).
 * With a definer come its `callers`: the leaves whose code is further out on the synchronous stack (see
 * runtime_outerCallers), which have to be allowed as well.
 * @param {string|null} [running=null] - The instance whose flow is running, when something names one (see the
 *   context managers' `runningInstanceID`): a file several running instances load untold apart is then that one's.
 * @returns {{wrapper: object, callers: Array<object>}|{leaves: Array<object>, callers: Array<object>}|{unplaced: true, shared?: true}|null} The
 *   definer. `shared` marks code of a file more than one running instance holds, with nothing naming which.
 * @internal
 */
export function frameDefiner(running = null) {
	const frames = runtime_captureFrames(24);
	let index = -1;
	// The helper file of an instance the innermost code runs in, while the walk looks for the leaf that called it.
	let helper = null;
	for (const frame of frames) {
		index++;
		if (frame.path.startsWith(FRAMEWORK_DIR + "/")) continue;
		// A helper's code with no leaf's code calling it (the helper's function handed out as it is): the module of the
		// one file that imports it stands for it.
		if (frame.async || isRunnerFrame(frame)) return helper ? (runtime_leafOfHelper(helper) ?? null) : null;
		// With no permission system on, nothing is refused: such code runs as plain JavaScript (#726).
		if (frame.evaluated || isForeignScript(frame)) return runtime_anyInstanceChecks() ? { unplaced: true } : null;
		const leaves = runtime_leavesAtLocation(frame.path, frame.line, running);
		if (leaves === null) {
			if (runtime_isInstanceFile(frame.path)) return { unplaced: true, shared: true };
			// A helper file of an instance that is no api file (one a leaf imports): its code runs for the leaf whose code
			// called it, so the walk goes on outward to the first frame of a leaf's file.
			const owner = runtime_helperOwner(frame, helper?.slothlet ?? null);
			if (owner) {
				helper ??= owner;
				continue;
			}
			// The host's code, or a package's, called it: no leaf did.
			return helper ? (runtime_leafOfHelper(helper) ?? null) : null;
		}
		if (helper) {
			// The leaf's file has to import the helper, or the helper is some other module's and cannot be placed.
			const imports = runtime_importsHelper(helper, leaves);
			if (!imports) return runtime_checksPermissions(helper.slothlet) ? { unplaced: true } : { wrapper: leaves[0], callers: [] };
		}
		const narrowed = runtime_narrowToLeaf(leaves, frame, runtime_framesAfter(frames, index));
		// The leaves whose code is further out on the stack ran this code: with no call to say who the caller is,
		// they are its callers, so a module running another's code from a timer of its own does not count as the host.
		const callers = runtime_anyInstanceChecks() ? runtime_outerCallers(frames, index).filter((caller) => !narrowed.includes(caller)) : [];
		return narrowed.length === 1 ? { wrapper: narrowed[0], callers } : { leaves: narrowed, callers };
	}
	return helper ? (runtime_leafOfHelper(helper) ?? null) : null;
}

/**
 * The running instance whose helper file a frame runs in: a file loaded under the instance's import tag, or one of its
 * CommonJS files, that no leaf was built from. Null for a CommonJS file more than one running instance loads.
 * @param {{path: string, line: string, evaluated?: boolean}} frame - The frame.
 * @param {object|null} [only=null] - Answer for this instance alone.
 * @returns {{slothlet: object, path: string}|null} The instance and the helper's file, or null.
 * @private
 */
function runtime_helperOwner(frame, only = null) {
	if (frame.evaluated || frame.path.startsWith("node:")) return null;
	const tag = runtime_frameInstanceTag(frame.line);
	let found = null;
	for (const [id, reference] of LIVE_INSTANCES) {
		const slothlet = reference.deref();
		if (!slothlet || (only && slothlet !== only) || !runtime_instanceRuns(slothlet)) continue;
		if (tag ? id !== tag : !runtime_commonJSLocations(id).has(frame.path)) continue;
		if (runtime_leavesAtFile(slothlet, frame.path, null, null).length) continue;
		// A CommonJS helper two running instances load carries no tag to tell them apart (#735): it is no one's here.
		if (found) return null;
		found = { slothlet, path: frame.path };
	}
	return found;
}

/**
 * The files of an instance that import a helper file, directly or through other helpers, as the instance's resolve
 * hook recorded them.
 * @param {{slothlet: object, path: string}} helper - The helper.
 * @returns {Set<string>} The importing files, in comparable form, the helper's own included.
 * @private
 */
function runtime_helperImporters(helper) {
	const graph = runtime_importGraph(helper.slothlet.instanceID);
	const seen = new Set([helper.path]);
	const queue = [helper.path];
	while (queue.length && seen.size <= PACKAGE_WALK) {
		for (const importer of graph.get(queue.pop()) ?? []) {
			if (seen.has(importer)) continue;
			seen.add(importer);
			queue.push(importer);
		}
	}
	return seen;
}

/**
 * Whether the file some leaves were built from imports a helper file, directly or through other helpers. A helper
 * whose imports were not recorded (a loader slothlet's hook does not see) is taken as imported by the leaf whose code
 * called it.
 * @param {{slothlet: object, path: string}} helper - The helper.
 * @param {Array<object>} leaves - The leaves of the calling file.
 * @returns {boolean} True when it does.
 * @private
 */
function runtime_importsHelper(helper, leaves) {
	if (leaves[0]?.slothlet !== helper.slothlet) return false;
	const importers = runtime_helperImporters(helper);
	if (importers.size === 1) return true;
	return leaves.some((leaf) => {
		const filePath = leaf.____slothletInternal.filePath;
		return Boolean(filePath) && (importers.has(toComparablePath(filePath)) || importers.has(runtime_realComparablePath(filePath)));
	});
}

/**
 * The definer of a helper file's code that no leaf's code called: the module of the one api file that imports the
 * helper. Undefined when no api file is recorded as importing it; unplaced when several are.
 * @param {{slothlet: object, path: string}} helper - The helper.
 * @returns {{wrapper: object, callers: Array<object>}|{leaves: Array<object>, callers: Array<object>}|{unplaced: true}|undefined} The definer.
 * @private
 */
function runtime_leafOfHelper(helper) {
	const modules = new Set();
	for (const file of runtime_helperImporters(helper)) {
		const leaves = runtime_leavesAtFile(helper.slothlet, file, null, null);
		if (!leaves.length) continue;
		for (const module of runtime_fileModuleOf(leaves)) modules.add(module);
	}
	if (!modules.size) return undefined;
	const found = [...modules];
	if (found.length === 1) return { wrapper: found[0], callers: [] };
	return runtime_checksPermissions(helper.slothlet) ? { unplaced: true } : { wrapper: found[0], callers: [] };
}

/**
 * Whether a file is one some running instance whose permission system is on built a leaf from.
 * @param {string} path - Comparable path.
 * @returns {boolean} True when one did.
 * @private
 */
function runtime_isInstanceFile(path) {
	for (const reference of LIVE_INSTANCES.values()) {
		const slothlet = reference.deref();
		if (
			slothlet &&
			runtime_checksPermissions(slothlet) &&
			runtime_instanceRuns(slothlet) &&
			runtime_leavesAtFile(slothlet, path, null, null).length
		)
			return true;
	}
	return false;
}

/**
 * Whether some running instance's permission system is on: only such an instance refuses code whose definer cannot be
 * told (#726).
 * @returns {boolean} True when one is.
 * @private
 */
function runtime_anyInstanceChecks() {
	for (const reference of LIVE_INSTANCES.values()) {
		const slothlet = reference.deref();
		if (slothlet && runtime_checksPermissions(slothlet) && runtime_instanceRuns(slothlet)) return true;
	}
	return false;
}

/**
 * Whether a call is read for another module's code running inside it whatever it was handed (#597): while the
 * permission system of its instance is on and its `provenance` is not turned off.
 * @param {{wrapper: object}|null|undefined} record - The call.
 * @returns {boolean} True when it is.
 * @private
 */
function runtime_guardsForeignCode(record) {
	const slothlet = record?.wrapper?.slothlet;
	return Boolean(slothlet?.handlers?.permissionManager?.isEnabled?.() && slothlet.config?.permissions?.provenance !== false);
}

/**
 * Each instance's leaves by the file they were built from, in comparable form (and real path, when a symlink makes
 * it differ), held weakly: who wrote code running from a file, found from a frame (#597).
 * @type {WeakMap<object, Map<string, Set<WeakRef<object>>>>}
 * @private
 */
const LEAF_FILES = new WeakMap();

/**
 * Index a wrapper by the file it was built from (see {@link LEAF_FILES}).
 * @param {object} wrapper - A genuine wrapper.
 * @returns {void}
 * @internal
 */
export function registerLeafFile(wrapper) {
	const filePath = wrapper?.____slothletInternal?.filePath;
	const slothlet = wrapper?.slothlet;
	if (!filePath || !slothlet || typeof WeakRef !== "function") return;
	if (slothlet.instanceID && !LIVE_INSTANCES.get(slothlet.instanceID)?.deref())
		LIVE_INSTANCES.set(slothlet.instanceID, new WeakRef(slothlet));
	let files = LEAF_FILES.get(slothlet);
	if (!files) LEAF_FILES.set(slothlet, (files = new Map()));
	const reference = new WeakRef(wrapper);
	// The file itself, and where its code actually runs from when that is another file: a TypeScript leaf runs from
	// the compiled copy slothlet wrote for it, so that copy's frames are the leaf's.
	const locations = new Set([toComparablePath(filePath), runtime_realComparablePath(filePath)]);
	for (const imported of runtime_importedLocations(wrapper, filePath) ?? []) locations.add(imported);
	for (const location of locations) {
		if (!location) continue;
		let held = files.get(location);
		if (!held) files.set(location, (held = new Set()));
		held.add(reference);
	}
}

/**
 * The live leaves of an instance a frame's code was written in: built from the frame's file, of the instance and mount
 * its import tags name when it carries them. Leaves no longer in the tree are passed over while the permission system
 * is on (see {@link runtime_leavesAtFile}).
 * @param {object} slothlet - The instance.
 * @param {{path: string, line: string}} frame - The frame.
 * @returns {Array<object>} The leaves.
 * @private
 */
function runtime_leavesAt(slothlet, frame) {
	return runtime_leavesAtFile(slothlet, frame.path, runtime_frameInstanceTag(frame.line), runtime_frameModuleTag(frame.line));
}

/**
 * The leaves of an instance built from a file, of the instance and mount given when they are (see
 * {@link runtime_leavesAt}): with its permission system on, only those still in the tree.
 * @param {object} slothlet - The instance.
 * @param {string} path - The file, in comparable form.
 * @param {string|null} instance - The instance tag the code carries, or null.
 * @param {string|null} mount - The mount tag the code carries, or null.
 * @returns {Array<object>} The leaves.
 * @private
 */
function runtime_leavesAtFile(slothlet, path, instance, mount) {
	const held = LEAF_FILES.get(slothlet)?.get(path);
	if (!held) return [];
	const leaves = [];
	// A removed node keeps its place while the permission system is off: nothing is checked, and what it made runs as plain
	// JavaScript, `self` included (#726).
	const keepGone = !runtime_checksPermissions(slothlet);
	for (const reference of held) {
		const wrapper = reference.deref();
		if (!wrapper) {
			held.delete(reference);
			continue;
		}
		if (runtime_isGone(wrapper) && !keepGone) continue;
		if (instance && wrapper.slothlet.instanceID !== instance) continue;
		if (mount && wrapper.____slothletInternal.moduleID !== mount) continue;
		leaves.push(wrapper);
	}
	return leaves;
}

/**
 * Whose code is running while no call of an instance's is (#597): the code nearest the stack's top that is not
 * slothlet's own or Node's decides. Code written in a file a module's leaves were built from is those leaves'; code of
 * the instance no leaf accounts for (a helper file of a module's, code compiled by someone) is no one's, and is refused
 * as such; anything else (the host's own code, a package's) is the host's. Read from the stack, so a function a module
 * left on an object of the host's, or on `globalThis`, is that module's whoever calls it later.
 * @param {object} slothlet - The instance.
 * @returns {Array<object>|null} The leaves whose code it is, empty for the host's, or null for code no one accounts for.
 * @internal
 */
export function runtime_codeWritersOnStack(slothlet) {
	const family = slothlet.instanceID;
	const sources = [{ family, slothlet, roots: [] }];
	for (const frame of runtime_captureFrames(48)) {
		if (frame.path.startsWith(FRAMEWORK_DIR + "/") || frame.path.startsWith("node:")) continue;
		if (frame.evaluated || isForeignScript(frame)) return stackHoldsInstanceCode(sources) ? null : [];
		const leaves = runtime_leavesAt(slothlet, frame);
		if (leaves.length) return leaves;
		const tag = runtime_frameInstanceTag(frame.line);
		if (tag && tag.startsWith(String(family).split("_reload_")[0])) return null;
		return [];
	}
	return [];
}

/**
 * The frames {@link runtime_foreignCodeRunning} reads first: enough to pass slothlet's own frames above an access made
 * through a view of `self` (up to 25 of them, for a data read in the live runtime) and reach the code making it.
 * @type {number}
 * @private
 */
const NEAR_FRAMES = 28;

/**
 * The frames {@link runtime_foreignCodeRunning} reads when 48 hold only slothlet's and Node's own and the stack goes on:
 * far enough for Node's own code recursing well over a hundred levels deep. Past it the access is refused.
 * @type {number}
 * @private
 */
const FAR_FRAMES = 1024;

/**
 * The placers of single calls, by wrapper and description, so a call read again reuses its own.
 * @type {WeakMap<object, {description: object, place: Function}>}
 * @private
 */
const SINGLE_PLACERS = new WeakMap();

/**
 * Who is doing an access inside a call that was handed nothing (#597): the code nearest the access that is not
 * slothlet's own decides. Another module's leaf's code there — a function of its own it passed by a route slothlet does
 * not see, run by this call's code — runs as that leaf, with this call (and whatever it already runs under) as its
 * ceiling, so both have to be allowed; with several leaves built from its file, all of them. Code of the instance no
 * leaf accounts for (a helper file of another module), and code compiled under some location by someone (`vm`,
 * `eval`), runs as no module and is refused. The leaf's own code, that of a call it runs under as its ceiling, the host's and a package's
 * run as the leaf, as before: a module's own
 * function runs as that module, whoever calls it, so only the code doing the access matters. One read of the stack,
 * deep enough to pass slothlet's own frames above the access.
 * @param {{wrapper: object, flagged: boolean}} record - The leaf's call.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|{unaccounted: true}|null} The leaf whose code it is
 *   and its ceiling, unaccounted code, or null when the leaf's own code (or the host's) is running.
 * @private
 */
function runtime_foreignCodeRunning(record) {
	const leaf = record.wrapper;
	const description = describeCall(leaf);
	if (!description.filePath) return null;
	const fileless = runtime_isHostObjectLeaf(leaf, description.filePath);
	const entryOf = (wrapper, call) => ({
		...describeCall(wrapper),
		currentWrapper: wrapper,
		family: wrapper.slothlet.instanceID,
		distance: 0,
		record: call
	});
	// A pinned call (a slothlet function a module read, run by another) carries the calls it runs under as its ceiling:
	// their code calling it is accounted for, held to them already.
	const ceilings = ceilingMembers(record.ceiling).filter(
		(wrapper) => wrapper && wrapper !== leaf && genuineWrappers.has(wrapper) && describeCall(wrapper).filePath
	);
	let cached = ceilings.length ? null : SINGLE_PLACERS.get(leaf);
	if (!cached || cached.description !== description) {
		const { place } = createFramePlacer([entryOf(leaf, record), ...ceilings.map((wrapper) => entryOf(wrapper, null))]);
		cached = { description, place };
		if (!ceilings.length) SINGLE_PLACERS.set(leaf, cached);
	}
	// `whole` says the capture reaches as far as the answer may need: a short first capture settles only what its own
	// frames decide, and leaves anything that reads the frames further out to the full one.
	const decide = (frames, whole) => {
		// Whether a builtin ran between the innermost code of anyone's (slothlet's own included) and the frames read
		// since, which are only Node's own: Node's code calling a builtin acts for no one more than the builtin does.
		let builtinSince = false;
		let index = -1;
		// Slothlet's own frames are passed over by their path and what they enter alone, so they are read no further.
		for (const frame of frames.lean?.() ?? frames) {
			index++;
			if (frame.path.startsWith(FRAMEWORK_DIR + "/")) {
				if (frame.enter) return null;
				builtinSince = false;
				continue;
			}
			// Reached the job's start with no code of anyone's doing the access and no call of slothlet's entered. Slothlet's
			// own code resumed there works for the call; code a builtin called from the job's start, straight or through
			// Node's own functions, runs in a chain of the engine's and Node's functions (bound built-ins a module queued,
			// say), which nobody wrote here.
			if (frame.async || isRunnerFrame(frame)) return frame.gap || builtinSince ? UNACCOUNTED_SUPPLIER : null;
			if (frame.evaluated || isForeignScript(frame)) return UNACCOUNTED_SUPPLIER;
			// Node's own code (`util.inspect` reading a value) acts for whoever called it: the next frame out decides. Only
			// Node's own scripts are passed over, told by their hash: a `node:` name is one any compiled code can take.
			if (frame.path.startsWith("node:")) {
				if (runtime_isNodeScript(frame)) {
					builtinSince ||= frame.gap;
					continue;
				}
				return UNACCOUNTED_SUPPLIER;
			}
			const placement = cached.place(frame);
			if (placement?.matches.length) return null;
			if (!whole) return undefined;
			// Code of no module's folder and no instance: a file some module loaded is that module's, the host's own runs as
			// the leaf.
			if (!placement) return isNode ? runtime_packageAnswer(record, frame, fileless) : null;
			return runtime_authorAnswer(record, frame, runtime_framesAfter(frames, index)) ?? UNACCOUNTED_SUPPLIER;
		}
		// The whole stack read without code of anyone's or a call of slothlet's: when a builtin began it, the engine's and
		// Node's own functions only.
		if (frames.truncated) return undefined;
		return frames.trailingGap || builtinSince ? UNACCOUNTED_SUPPLIER : null;
	};
	// The frame that decides is nearly always the code making the access, a few frames below slothlet's own: a short
	// capture finds it at a fraction of the cost of a full one, which is read only when the short one settles nothing.
	// Both are read at this same point, so the short one's frames are the full one's first frames, and what they decide
	// is what the full capture would decide.
	const near = runtime_captureFrames(NEAR_FRAMES);
	const settled = decide(near, !near.truncated);
	if (settled !== undefined || !near.truncated) return settled ?? null;
	const full = decide(runtime_captureFrames(48), true);
	if (full !== undefined) return full;
	// Cut off inside slothlet's and Node's own frames, with the stack going on: the code making the access was not
	// reached (Node's own code recursing, say `util.inspect` deep in a value, calls an api function from the bottom of
	// it). It is read further out, and when that still reaches no one's code nothing says whose access it is: it is
	// refused, not taken to be the leaf's own.
	const far = decide(runtime_captureFrames(FAR_FRAMES), true);
	return far === undefined ? UNACCOUNTED_SUPPLIER : far;
}

/**
 * Whether a call's identity is resolved from the stack (see {@link resolveSupplier}) rather than taken as its leaf's.
 * @param {{wrapper: object, flagged: boolean}|null|undefined} record - The call.
 * @returns {boolean} True when it is.
 * @internal
 */
export function resolvesSupplier(record) {
	return Boolean(record?.flagged) || runtime_guardsForeignCode(record);
}

/**
 * The answer {@link resolveSupplier} gives for code running inside a call entered by code no call accounts for (a node
 * a module kept, used from a timer; #661): code that cannot be placed is its caller's, and that caller is refused. Code
 * of the host's own, or a package's, running inside it is the leaf's, held to what the leaf may do, as it is inside a
 * call the host made. Code of another of the instance's modules is refused, and a node its module kept answers for it.
 * @param {{wrapper: object, flagged: boolean}} record - The leaf's call.
 * @returns {{unaccounted: true}|null} Unaccounted code, or null when the leaf's own code (or the host's) is running.
 * @private
 */
function runtime_unaccountedInside(record) {
	const leaf = record.wrapper;
	const description = describeCall(leaf);
	if (!description.filePath) return null;
	const { place } = createFramePlacer([{ ...description, currentWrapper: leaf, family: leaf.slothlet.instanceID, distance: 0, record }]);
	// The frames that decide sit near the top of the stack: the capture is widened only when it was cut short first.
	const decide = (frames) => {
		for (const frame of frames) {
			if (frame.path.startsWith(FRAMEWORK_DIR + "/")) {
				if (frame.enter) return null;
				continue;
			}
			if (frame.async || isRunnerFrame(frame)) return null;
			const placement = place(frame);
			// Code of no instance (the host's, a package's) and the leaf's own run as the leaf, as before.
			if (!placement || placement.matches.length) continue;
			return UNACCOUNTED_SUPPLIER;
		}
		return frames.truncated ? undefined : null;
	};
	const answer = decide(runtime_captureFrames(16));
	return answer === undefined ? (decide(runtime_captureFrames(80)) ?? null) : answer;
}

/**
 * What {@link resolveSupplier} answers for code no call accounts for.
 * @type {Readonly<{unaccounted: true}>}
 * @private
 */
const UNACCOUNTED_SUPPLIER = Objects.freeze({ unaccounted: true });

/**
 * What {@link resolveSupplier} answers for code that is accounted for and refused: a leaf's own exported function
 * entered as it is by a caller that may not call that leaf. Unlike code no call accounts for, it is not read by its
 * frames afterwards: the caller is unresolved, and every access under it is refused.
 * @type {Readonly<{unaccounted: true, refused: true}>}
 * @private
 */
const REFUSED_SUPPLIER = Objects.freeze({ unaccounted: true, refused: true });

/**
 * The answer {@link resolveSupplier} gives for a supplier found up a chain: its wrapper, under the leaf — or, with
 * `permissions.ceiling: "chain"`, under every call from the leaf up to it and every ceiling those calls and its own call
 * carried.
 * @param {{wrapper: object, parent: object|null, ceiling?: object|null}} record - The leaf's call.
 * @param {{currentWrapper: object, record: object}} supplier - The supplier's call.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}} The answer.
 * @private
 */
function runtime_supplierAnswer(record, supplier) {
	// By default the supplier is held to the leaf its code is running inside; `permissions.ceiling: "chain"` carries
	// every call it was handed through, and the ceilings they carried, as well.
	if (record.wrapper.slothlet?.config?.permissions?.ceiling !== "chain")
		return { wrapper: supplier.currentWrapper, ceiling: record.wrapper };
	const parts = [supplier.record.ceiling];
	for (let current = record, depth = 0; current && current !== supplier.record && depth < MAX_CHAIN; current = current.parent, depth++) {
		parts.push(current.wrapper, current.ceiling);
	}
	const members = ceilingMembers(combineCeilings(...parts)).filter((member) => member !== supplier.currentWrapper);
	return { wrapper: supplier.currentWrapper, ceiling: combineCeilings(...members) };
}

/**
 * The scripts of Node's own code that read values for whoever called it, by location (#597): their hashes as V8 reports
 * them, taken from a real `util.inspect` reading a getter when this file loads, before any module's code runs. A frame
 * named `node:…` is Node's own only when its script is one of these; code compiled by anyone under such a name runs
 * in a script of its own.
 * @type {Map<string, Set<string>>}
 * @private
 */
const NODE_SCRIPTS = new Map();

/**
 * The source of each of Node's own scripts, by id (`fs`, `internal/fs/read/context`), copied when this file loads,
 * before any module's code runs, from the table Node compiles them from. V8 reports a script of Node's own under
 * `node:<id>` with the SHA-256 of exactly this source, so a frame of it can be told from code anyone compiled under the
 * same name. Strings cannot be changed, so a module changing the table afterwards changes nothing here. Empty where
 * the table is not offered; {@link NODE_SCRIPTS} is then what is known.
 * @type {Map<string, string>}
 * @private
 */
const NODE_SOURCES = new Map();

/**
 * The SHA-256 of each of Node's own scripts in {@link NODE_SOURCES}, computed when first needed.
 * @type {Map<string, string>}
 * @private
 */
const NODE_SOURCE_HASHES = new Map();

if (isNode) {
	try {
		for (const [id, source] of Objects.entries(globalThis.process.binding("natives"))) {
			if (typeof source === "string") NODE_SOURCES.set(id, source);
		}
	} catch {
		// A Node that no longer offers the table: Node's own scripts are known from the sample alone.
	}
}

/**
 * Whether a `node:` frame runs one of Node's own scripts: its script hashes as the source Node compiles under that
 * name does, or as one sampled from Node's own code when this file loaded (see {@link NODE_SCRIPTS}). Code compiled by
 * anyone else under a `node:` name runs in a script of its own source, and is not.
 * @param {{path: string, hash: string|null}} frame - A frame whose location starts with `node:`.
 * @returns {boolean} True for Node's own code.
 * @private
 */
function runtime_isNodeScript(frame) {
	if (!frame.hash) return false;
	if (NODE_SCRIPTS.get(frame.path)?.has(frame.hash)) return true;
	const id = frame.path.slice("node:".length);
	const source = NODE_SOURCES.get(id);
	if (source === undefined) return false;
	let hash = NODE_SOURCE_HASHES.get(id);
	if (hash === undefined) {
		hash = sha256(source, "utf8");
		NODE_SOURCE_HASHES.set(id, hash);
	}
	return frame.hash === hash;
}

/**
 * Record the `node:` scripts on the stack right now as Node's own (see {@link NODE_SCRIPTS}).
 * @returns {void}
 * @private
 */
function runtime_sampleNodeScripts() {
	for (const frame of runtime_captureFrames(64)) {
		if (!frame.path.startsWith("node:") || !frame.hash || frame.evaluated) continue;
		let hashes = NODE_SCRIPTS.get(frame.path);
		if (!hashes) NODE_SCRIPTS.set(frame.path, (hashes = new Set()));
		hashes.add(frame.hash);
	}
}

if (isNode) {
	// Sampled through each way Node's own code calls back into code it was handed: reading a getter (`util.inspect`),
	// running a store (`AsyncLocalStorage`), emitting (`EventEmitter`), and its timer and tick queues.
	const builtin = (id) => globalThis.process.getBuiltinModule(id);
	for (const sample of [
		() =>
			builtin("node:util").inspect(
				{
					get value() {
						runtime_sampleNodeScripts();
						return 0;
					}
				},
				{ getters: true }
			),
		() => {
			const storage = new (builtin("node:async_hooks").AsyncLocalStorage)();
			storage.run({}, runtime_sampleNodeScripts);
			storage.run({}, () => storage.exit(runtime_sampleNodeScripts));
		},
		() => {
			const emitter = new (builtin("node:events").EventEmitter)();
			emitter.on("sample", runtime_sampleNodeScripts);
			emitter.emit("sample");
		},
		() => builtin("node:timers").setTimeout(runtime_sampleNodeScripts, 0).unref(),
		() => globalThis.process.nextTick(runtime_sampleNodeScripts)
	]) {
		try {
			sample();
		} catch {
			// A sample that fails leaves its scripts unrecorded: their frames are then refused, which fails closed.
		}
	}
}
