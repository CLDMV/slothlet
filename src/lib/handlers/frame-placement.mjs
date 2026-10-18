/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/frame-placement.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
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
import { instanceCommonJSFiles, instanceCommonJSVersion, instanceImporters } from "@cldmv/slothlet/helpers/instance-imports";
import { genuineWrappers } from "#handlers/trusted-root";

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
			const resolved = globalThis.process?.getBuiltinModule?.("node:fs")?.realpathSync?.(filePath);
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
 * @returns {Iterable<{head: string, path: string, line: string, async: boolean, evaluated: boolean}> & {truncated: boolean}} The frames.
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
		if (frame) frames.push({ ...frame, line, async: /^at async /.test(line.trim()), evaluated: /\beval at\b/.test(line) });
	}
	frames.truncated = frames.length >= limit;
	return frames;
}

/**
 * V8's `prepareStackTrace` hook for {@link runtime_captureFrames}: the call sites as frames, without
 * formatting them.
 * @param {Error} _error - The error being captured.
 * @param {Array<object>} callSites - V8 call sites, innermost first.
 * @returns {{structured: true, truncated: boolean}} The frames, iterable innermost first.
 * @private
 */
function runtime_structuredFrames(_error, callSites) {
	// Converted as the resolver walks them, innermost first: it usually stops within the first few.
	return {
		[Symbol.iterator]: function* frames() {
			for (const site of callSites) {
				// An eval'd frame names the file it was evaluated from in its origin, as the formatted text does.
				const sourceURL = site.getScriptNameOrSourceURL?.() ?? null;
				const fileName = site.getFileName?.() ?? null;
				const location = sourceURL ?? fileName;
				const evaluated = Boolean(site.isEval?.());
				const origin = evaluated ? String(site.getEvalOrigin?.() ?? "") : "";
				if (!location && !origin) continue;
				const typeName = site.isToplevel?.() ? null : site.getTypeName?.();
				const name = site.getFunctionName?.() ?? site.getMethodName?.() ?? "";
				const head = `at ${site.isAsync?.() ? "async " : ""}${typeName && name ? `${typeName}.` : ""}${name}`;
				yield {
					head,
					path: runtime_comparableLocation(location ?? origin),
					line: `${head} (${location ?? ""}) ${origin}`,
					async: Boolean(site.isAsync?.()),
					// Evaluated code, or code naming a source it was not loaded from (a `//# sourceURL`): its location
					// is whatever the evaluating code chose, so it cannot attribute anything to anyone (#597).
					evaluated: evaluated || (sourceURL !== null && fileName !== null && sourceURL !== fileName)
				};
			}
		},
		structured: true,
		truncated: callSites.length >= PristineError.stackTraceLimit
	};
}

/**
 * Comparable forms of frame locations already seen. A stack names a bounded set of code locations, read
 * on every capture; the cap only guards a process that evaluates an unbounded number of distinct sources.
 * @type {Map<string, string>}
 * @private
 */
const COMPARABLE_LOCATIONS = new Map();

/**
 * {@link toComparablePath} for a frame location, remembered.
 * @param {string} location - A frame's location.
 * @returns {string} Its comparable form.
 * @private
 */
function runtime_comparableLocation(location) {
	let comparable = COMPARABLE_LOCATIONS.get(location);
	if (comparable === undefined) {
		comparable = toComparablePath(location);
		if (COMPARABLE_LOCATIONS.size >= 4096) COMPARABLE_LOCATIONS.clear();
		COMPARABLE_LOCATIONS.set(location, comparable);
	}
	return comparable;
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
		// Two mounts of one folder share the file but not the copy: the frame's mount tag picks its call.
		const frameModule = runtime_frameModuleTag(frame.line);
		const byFile = candidates.filter(
			(entry) =>
				isEntryLocation(frame.path, entry) &&
				(!frameInstance || !entry.family || entry.family === frameInstance) &&
				(!frameModule || entry.moduleID === frameModule)
		);
		if (byFile.length) return { matches: byFile, byFile: true };
		const frameFamilies = frameInstance ? new Set([frameInstance]) : commonJSFamiliesAt(frame.path);
		if (frameFamilies) {
			const owners = candidates.filter((entry) => {
				if (!frameFamilies.has(entry.family)) return false;
				// A leaf's own copy names its mount: only that mount's calls can be running it.
				if (frameModule && entry.moduleID !== frameModule) return false;
				for (const importer of importersOf(entry.family, frame.path)) if (isEntryLocation(importer, entry)) return true;
				return false;
			});
			return { matches: owners, byFile: false };
		}
		const owner = roots.find(({ root }) => frame.path.startsWith(root + "/"));
		if (owner) return { matches: candidates.filter((entry) => entry.moduleID === owner.moduleID), byFile: false, byModule: true };
		return null;
	};

	return { place, families };
}

/**
 * Whether a frame is one the microtask runner puts below a resumed function: a resumed function has
 * nothing of its own below it.
 * @param {{path: string, head: string}} frame - A frame.
 * @returns {boolean} True for a runner frame.
 * @internal
 */
export function isRunnerFrame(frame) {
	return frame.path.startsWith("node:internal/process/task_queues") || /\b(?:processTicksAndRejections|runMicrotasks)\b/.test(frame.head);
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
export function setApiValueCheck(check) {
	isApiValue = check;
}

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
 * it: a primitive, one of slothlet's own api values, or a non-Proxy object whose prototype is
 * `Object.prototype`, `Array.prototype` or `null` and whose own properties are all data properties holding plain
 * data — within {@link PLAIN_DATA_DEPTH} and {@link PLAIN_DATA_PROPERTIES}.
 *
 * Nothing of the caller's runs while deciding: a Proxy is recognised before anything is read from it, and an
 * ordinary object's prototype, keys and property descriptors are read without running a getter. Without a
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
	if (genuineWrappers.has(value) || isApiValue(value)) return true;
	if (typeof value === "function" || depth <= 0 || !isNode || util.types.isProxy(value)) return false;
	try {
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return false;
		const keys = Reflect.ownKeys(value);
		budget.remaining -= keys.length;
		if (budget.remaining < 0) return false;
		for (const key of keys) {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			if (!descriptor || !Object.hasOwn(descriptor, "value") || !runtime_isPlainData(descriptor.value, depth - 1, budget)) return false;
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
const carriesCode = (value, budget) =>
	value !== null &&
	(typeof value === "object" || typeof value === "function") &&
	!genuineWrappers.has(value) &&
	!isApiValue(value) &&
	!runtime_isPlainData(value, PLAIN_DATA_DEPTH, budget);

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
 * The most calls up a chain looked at for a supplier. Chains are as deep as module calls nest; this bounds
 * the walk for a pathological one.
 * @type {number}
 * @private
 */
const MAX_CHAIN = 64;

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
 * Only a flagged call with a module above it is resolved: everything else answers without reading the stack.
 *
 * @param {{wrapper: object, parent: object|null, flagged: boolean}|null|undefined} record - The running call.
 * @returns {object|null} The supplier's wrapper when it is a call above the leaf, otherwise null (the leaf's
 *   own code is running).
 * @internal
 */
export function resolveSupplier(record) {
	if (!record?.flagged || !record.parent?.wrapper) return null;
	const leaf = record.wrapper;
	if (!genuineWrappers.has(leaf)) return null;
	const chain = [];
	const seen = new Set([leaf]);
	// The call that made the leaf's: what an unattributable frame is taken to be.
	let fallback = null;
	const leafDescription = describeCall(leaf);
	if (leafDescription.filePath) chain.push({ ...leafDescription, currentWrapper: leaf, family: leaf.slothlet.instanceID, distance: 0 });
	let current = record.parent;
	for (let depth = 1; current && depth < MAX_CHAIN; depth++, current = current.parent) {
		const wrapper = current.wrapper;
		if (!wrapper || seen.has(wrapper) || !genuineWrappers.has(wrapper)) continue;
		seen.add(wrapper);
		fallback ??= wrapper;
		const description = describeCall(wrapper);
		// A call with no file (an in-memory module) has no frames of its own to be placed on.
		if (!description.filePath) continue;
		chain.push({ ...description, currentWrapper: wrapper, family: wrapper.slothlet.instanceID, distance: chain.length });
	}
	if (!fallback) return null;
	// The leaf has no file of its own: none of the code running inside it can be told to be its own.
	if (!chain.length || chain[0].currentWrapper !== leaf) return fallback;
	const { place } = createFramePlacer(chain);

	const decide = (frames) => {
		for (const frame of frames) {
			if (frame.path.startsWith(FRAMEWORK_DIR + "/")) continue;
			if (frame.evaluated) return fallback;
			const placement = place(frame);
			if (!placement || !placement.matches.length) return fallback;
			const { matches } = placement;
			if (matches.length === 1 && matches[0].currentWrapper === leaf) return leaf;
			let nearest = null;
			for (const match of matches) if (match.currentWrapper !== leaf && (!nearest || match.distance < nearest.distance)) nearest = match;
			return nearest ? nearest.currentWrapper : fallback;
		}
		return undefined;
	};

	// The frame that decides sits near the top of the stack, so the capture starts small and is widened only
	// when it was cut short before reaching a frame of anyone's.
	const frames = runtime_captureFrames(12);
	let answer = decide(frames);
	if (answer === undefined && frames.truncated) answer = decide(runtime_captureFrames(80));
	if (answer === undefined) return fallback;
	return answer === leaf ? null : answer;
}
