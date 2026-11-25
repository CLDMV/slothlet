/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/frame-placement.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:44:32-08:00 (1795635872)
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
import { segmentsOf } from "#helpers/segments";
import { DEFAULT_SEARCH_DEPTH, DEFAULT_SEARCH_PROPERTIES } from "#helpers/defaults";
import { AsyncResource, isNode, util } from "#helpers/platform";
import {
	rememberNewest,
	LOADED_BY_SPECIFIER,
	VITE_HOST_SCRIPTS,
	VITE_LOADED_BY,
	internals as instanceImportsInternals
} from "#helpers/instance-imports";
import { ceilingMembers, combineCeilings, internals as trustedRootInternals } from "#handlers/trusted-root";
import {
	appendList,
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	decodeURIComponent,
	Error,
	filterList,
	functionSource,
	generatorSteps,
	JSON,
	listPush,
	listSplice,
	listSteps,
	Map,
	mapEntries,
	mapKeys,
	mapList,
	MapMethods,
	matchAllOf,
	Math,
	Objects,
	Processes,
	PrototypeFunctions,
	Reflect,
	RegExp,
	RegExpMethods,
	regExpReplace,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	splitText,
	String,
	StringMethods,
	Symbol,
	Symbols,
	TextDecoder,
	URL,
	URLMethods,
	URLSearchParams,
	URLSearchParamsMethods,
	WeakMap,
	WeakMapMethods,
	WeakRef,
	WeakRefMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { SlothletError } from "#errors";
import { hasEngineStack, readStack, stackBudget, unreadError } from "#helpers/stack-read";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";
const {
	instanceCommonJSFiles,
	instanceCommonJSVersion,
	instanceCopyCount,
	instanceCopyExports,
	instanceImporters,
	loadedScriptLookup,
	loadedScriptText,
	packageImporters,
	scriptKeyInstance,
	setScriptKey,
	setCallerCheck
} = instanceImportsInternals("lib/handlers/frame-placement");
const trustedRootOwn = trustedRootInternals("lib/handlers/frame-placement");

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
const NODE_FS = isNode ? Processes.getBuiltinModule("node:fs") : null;
const NODE_CRYPTO = isNode ? Processes.getBuiltinModule("node:crypto") : null;
const FS_READ_FILE = NODE_FS?.readFileSync;
const FS_STAT = NODE_FS?.statSync;
const FS_EXISTS = NODE_FS?.existsSync;
const FS_REALPATH = NODE_FS?.realpathSync;
const CRYPTO_CREATE_HASH = NODE_CRYPTO?.createHash;
const HASH_PROTOTYPE = NODE_CRYPTO ? Objects.getPrototypeOf(Reflect.apply(CRYPTO_CREATE_HASH, NODE_CRYPTO, ["sha256"])) : null;
const HASH_UPDATE = HASH_PROTOTYPE?.update;
const HASH_DIGEST = HASH_PROTOTYPE?.digest;
const CapturedTextDecoder = TextDecoder;
const TEXT_DECODE = PrototypeFunctions.TextDecoder.decode;
const JSON_PARSE = JSON.parse;
const MAP_FOREACH = PrototypeFunctions.Map.forEach;
const SET_FOREACH = PrototypeFunctions.Set.forEach;
const CapturedURLSearchParams = URLSearchParams;
const CapturedURLSearchParamsGet = PrototypeFunctions.URLSearchParams.get;

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
		Reflect.apply(MAP_FOREACH, map, [(value) => listPush(values, value)]);
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
		Reflect.apply(SET_FOREACH, set, [(member) => listPush(members, member)]);
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
const escapeForRegExp = (literal) => regExpReplace(/[.*+?^${}()|[\]\\]/g, literal, "\\$&");

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
	let text = regExpReplace(/\\/g, String(value), "/");
	if (RegExpMethods.exec(/^[a-z][a-z0-9+.-]*:\/\//i, text) !== null) {
		text = regExpReplace(/[?#].*$/, text, "");
		try {
			text = decodeURIComponent(text);
		} catch {
			// A malformed escape cannot name a real file differently than it is spelled; compare it raw.
		}
		text = regExpReplace(/^file:\/\//i, text, "");
		// `file:///C:/x` → `C:/x`, the spelling a Windows path takes once its separators are normalised.
		if (RegExpMethods.exec(/^\/[a-z]:\//i, text) !== null) text = StringMethods.slice(text, 1);
	} else {
		text = regExpReplace(/\?.*$/, text, "");
	}
	return regExpReplace(/\/+$/, text, "");
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
function runtime_importedLocations(wrapper, filePath) {
	if (!filePath) return null;
	const recorded = wrapper?.slothlet?.processors?.loader?.importedLocationsFor?.(filePath, wrapper?.____slothletInternal?.moduleID);
	if (!recorded?.size) return null;
	return setFrom(mapList(setToArray(recorded), toComparablePath));
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
function runtime_realComparablePath(filePath) {
	if (!filePath) return null;
	let real = MapMethods.get(REAL_PATHS, filePath);
	if (real === undefined) {
		real = null;
		try {
			const resolved = FS_REALPATH ? nodeFs(FS_REALPATH, filePath) : null;
			if (resolved && toComparablePath(resolved) !== toComparablePath(filePath)) real = toComparablePath(resolved);
		} catch {
			// A path that does not resolve (a synthetic or browser path) has no other spelling.
		}
		MapMethods.set(REAL_PATHS, filePath, real);
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
function runtime_entryNames(apiPath, currentWrapper) {
	const names = setFrom([StringMethods.slice(apiPath, StringMethods.lastIndexOf(apiPath, ".") + 1)]);
	const impl = currentWrapper?.____slothletInternal?.impl;
	if (typeof impl === "function" && typeof impl.name === "string" && impl.name && impl.name !== "anonymous")
		SetMethods.add(names, impl.name);
	return filterList(setToArray(names), Boolean);
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
	const cached = WeakMapMethods.get(IMPORT_GRAPHS, source);
	if (cached && cached.edges === edges) return cached;
	const graph = new Map();
	const files = new Set();
	// The graph is a view another copy of slothlet may have made: its walk is a generator, stepped with the functions
	// taken at load; each entry is a fresh [file, importers array] pair.
	for (const entry of generatorSteps(source[Symbol.iterator]())) {
		const location = toComparablePath(entry[0]);
		const importers = entry[1];
		if (!MapMethods.has(graph, location)) MapMethods.set(graph, location, new Set());
		SetMethods.add(files, location);
		for (let i = 0; i < importers.length; i++) {
			const from = toComparablePath(importers[i]);
			SetMethods.add(MapMethods.get(graph, location), from);
			SetMethods.add(files, from);
		}
	}
	const entry = { edges, graph, files };
	WeakMapMethods.set(IMPORT_GRAPHS, source, entry);
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
 * @param {object} cacheManager - The instance's api cache manager.
 * @returns {Array<{moduleID: string, root: string}>} Module roots.
 * @private
 */
function runtime_moduleRoots(cacheManager) {
	const cached = WeakMapMethods.get(MODULE_ROOTS, cacheManager);
	if (cached && cached.version === cacheManager.version) return cached.roots;
	const roots = [];
	for (let ofIndex = 0, ofList = cacheManager.getAllModuleIDs(); ofIndex < ofList.length; ofIndex++) {
		const moduleID = ofList[ofIndex];
		const { folderPath } = cacheManager.get(moduleID);
		// No base directory (`base: null`) and in-memory modules have no folder to own files by.
		if (typeof folderPath !== "string" || StringMethods.startsWith(folderPath, "synthetic:")) continue;
		listPush(roots, { moduleID, root: toComparablePath(folderPath) });
		// A root reached through a symlink: frames name its files by their real path.
		const realRoot = runtime_realComparablePath(folderPath);
		if (realRoot) listPush(roots, { moduleID, root: realRoot });
	}
	// An empty root (a module mounted from `/`) would own every absolute path; it owns nothing.
	const sorted = ArrayMethods.sort(
		filterList(roots, ({ root }) => root),
		(a, b) => b.root.length - a.root.length
	);
	WeakMapMethods.set(MODULE_ROOTS, cacheManager, { version: cacheManager.version, roots: sorted });
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
	const cached = WeakMapMethods.get(COMMONJS_LOCATIONS, version.key);
	if (cached && cached.count === version.count) return cached.locations;
	const locations = new Set();
	for (let i = 0, commonJSFiles = instanceCommonJSFiles(family); i < commonJSFiles.length; i++) {
		const file = commonJSFiles[i];
		SetMethods.add(locations, toComparablePath(file));
		const real = runtime_realComparablePath(file);
		if (real) SetMethods.add(locations, real);
	}
	WeakMapMethods.set(COMMONJS_LOCATIONS, version.key, { count: version.count, locations });
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
	let set = WeakMapMethods.get(LOADED_LOCATIONS, list);
	if (!set) {
		set = setFrom(mapList(list, toComparablePath));
		WeakMapMethods.set(LOADED_LOCATIONS, list, set);
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
		entry.namePattern = names.length
			? new RegExp(`(?:^|[\\s.])(?:${ArrayMethods.join(mapList(names, escapeForRegExp), "|")})(?=\\s|$|\\[)`)
			: null;
	}
	return entry.namePattern !== null && RegExpMethods.exec(entry.namePattern, StringMethods.trim(head) + " ") !== null;
}

/**
 * The instance whose import tag a stack line carries: every file slothlet imports for an instance — a
 * leaf, and each helper it imports — is loaded under `?slothlet_instance=<id>`, and host code never is.
 * @param {string} line - One stack line.
 * @returns {string|null} The instance ID, or null.
 * @private
 */
function runtime_frameInstanceTag(line) {
	return RegExpMethods.exec(/[?&]slothlet_instance=([^&#:)\s]+)/, line)?.[1] ?? null;
}

/**
 * The reload stamp the file a stack line runs was imported under (`&_reload=`, see `Loader`), or null.
 * @param {string} line - One stack line.
 * @returns {string|null} The stamp.
 * @private
 */
function runtime_frameReloadStamp(line) {
	return RegExpMethods.exec(/[?&]_reload=([^&#:)\s]+)/, line)?.[1] ?? null;
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
	const tag = RegExpMethods.exec(/[?&]module=([^&#:)\s]+)/, line)?.[1];
	if (!tag) return null;
	const spaced = regExpReplace(/\+/g, tag, " ");
	try {
		return decodeURIComponent(spaced);
	} catch {
		// A malformed escape cannot name a moduleID other than as spelled.
		return spaced;
	}
}

/**
 * The api file a helper copy's stack line says it was loaded for, and that file's mount: with `helpers: "module"` an
 * instance loads each helper once per importing api file, under `&slothlet_for=<api file>` (and `&slothlet_mount=`
 * for a mounted folder's file), so the copy's frames name the one api file whose code they are. Null for a helper
 * loaded once per instance, which carries none.
 * @param {string} line - One stack line.
 * @returns {{path: string, mount: string|null}|null} The api file in comparable form and its mount, or null.
 * @private
 */
function runtime_frameImporterTag(line) {
	const tag = RegExpMethods.exec(/[?&]slothlet_for=([^&#:)\s]+)/, line)?.[1];
	if (!tag) return null;
	const decode = (value) => {
		const spaced = regExpReplace(/\+/g, value, " ");
		try {
			return decodeURIComponent(spaced);
		} catch {
			// A malformed escape cannot name a file other than as spelled.
			return spaced;
		}
	};
	const mount = RegExpMethods.exec(/[?&]slothlet_mount=([^&#:)\s]+)/, line)?.[1];
	return { path: toComparablePath(decode(tag)), mount: mount ? decode(mount) : null };
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
 * short, so a reader that found nothing can look deeper. The formatter is slothlet's own, set for this
 * capture by {@link readStack}, which also holds the global `Error` and the frame budget as plain values for
 * the read: a formatter, an accessor or another `Error` a leaf installed could otherwise blank or forge the
 * frames this resolver matches on, and a caller that cannot be attributed would be let through as though it
 * were the host. Everything is put back immediately, so a legitimate consumer's formatter is unaffected.
 * When the read cannot be held that way (a setting fixed in place) the access is refused.
 *
 * @param {number} limit - The most frames to capture.
 * @returns {Iterable<{head: string, path: string, line: string, async: boolean, evaluated: boolean, hash: string|null, key: string|null, enter: "leaf"|"call"|null, gap: boolean}> & {truncated: boolean, trailingGap: boolean}} The frames.
 * @throws {SlothletError} PERMISSION_DENIED when the stack cannot be read with slothlet's own formatter.
 * @private
 */
function runtime_captureFrames(limit) {
	const read = readStack(runtime_structuredFrames, { limit });
	// The global `Error` or its stack settings were changed so that slothlet's own formatter could not be the one that
	// ran: the frames are not the engine's, and what they would have decided is refused.
	if (read === null) throw new SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf("self") });
	if (read.value?.structured) return read.value;
	// An engine without V8's call-site hook formats the trace as text, which is parsed instead.
	return textFrames(String(read.text ?? ""), limit);
}

/**
 * Frames from a stack formatted as text (an engine without V8's call-site hook: Firefox, Safari), innermost first.
 *
 * Code compiled from a string is marked `evaluated`, whichever engine wrote the line, so it is never taken for the
 * code of the file that compiled it:
 *
 * - V8: `at f (eval at g (file.js:3:9), <anonymous>:1:1)`.
 * - SpiderMonkey (Firefox): the location names the file and line the code was compiled at, then what compiled it:
 *   `f@file.js line 3 > eval:1:1`, `anonymous@file.js line 3 > Function:1:1`, nested `… line 3 > eval line 1 > eval:1:1`.
 *   Any location with a ` line N > ` step is taken as compiled code.
 * - JavaScriptCore (Safari): eval and `Function` code has no location at all: `eval code@`, `anonymous@`. A line whose
 *   location is empty is taken as compiled code, whatever its function name says, as a function name is not to be
 *   trusted (see {@link parseStackFrame}).
 *
 * A built-in's frame (`map@[native code]`) has no location and is passed over.
 *
 * @param {string} text - The stack.
 * @param {number} limit - The frame budget the stack was captured with.
 * @returns {Array<{head: string, path: string, line: string, async: boolean, evaluated: boolean, hash: null, key: null, enter: "leaf"|"call"|null, gap: boolean}> & {truncated: boolean, trailingGap: boolean}} The frames.
 * @internal
 * @example
 * textFrames("@http://host/api/run.mjs line 3 > eval:1:1\nrun@http://host/api/run.mjs:3:9", 10);
 * // [{ path: "http://host/api/run.mjs line 3 > eval", evaluated: true, … }, { path: "http://host/api/run.mjs", evaluated: false, … }]
 */
export function textFrames(text, limit) {
	const frames = [];
	for (let ofIndex = 0, ofList = splitText(String(text), "\n"); ofIndex < ofList.length; ofIndex++) {
		const line = ofList[ofIndex];
		const trimmed = StringMethods.trim(line);
		if (StringMethods.endsWith(trimmed, "@[native code]")) continue;
		// JavaScriptCore's compiled code: a frame with no location.
		const unlocated = !StringMethods.startsWith(trimmed, "at ") && StringMethods.endsWith(trimmed, "@");
		const frame = unlocated ? { head: StringMethods.slice(trimmed, 0, -1), path: "" } : parseStackFrame(line);
		if (frame) {
			listPush(frames, {
				...frame,
				line,
				async: RegExpMethods.exec(/^at async /, trimmed) !== null,
				evaluated: unlocated || RegExpMethods.exec(/\beval at\b/, line) !== null || RegExpMethods.exec(/ line \d+ > /, line) !== null,
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
		// Each walk steps its generator with the functions taken at load (see helpers/intrinsics `generatorSteps`).
		[Symbol.iterator]: () => generatorSteps(runtime_siteFrames(callSites, false)),
		// The same frames, in the same order, with slothlet's own described only by where they are and what they enter:
		// for a reader that passes over slothlet's own frames by those two alone.
		lean: () => generatorSteps(runtime_siteFrames(callSites, true)),
		// The same frames after the one at an index, converted only from there (see runtime_framesAfter).
		after: (index) => generatorSteps(runtime_siteFrames(callSites, false, index + 1)),
		structured: true,
		truncated: callSites.length >= stackBudget(),
		// Whether the outermost frame is a builtin's, which has no location: what began the job is the engine's own.
		trailingGap: callSites.length > 0 && runtime_isBuiltinSite(callSites[callSites.length - 1])
	};
}

/**
 * V8 call sites as frames, innermost first, each converted as it is reached.
 * @param {Array<object>} callSites - V8 call sites, innermost first.
 * @param {boolean} lean - Describe a frame located in slothlet's own folder by its `path` and `enter` alone.
 * @param {number} [skip=0] - How many of the first frames to pass over unconverted: the frames from there are the same
 *   frames, with the same `gap`, as a walk from the start yields at those places.
 * @returns {Generator<object>} The frames.
 * @private
 */
function* runtime_siteFrames(callSites, lean, skip = 0) {
	// Whether a frame with no location (a builtin's) was passed over since the last one yielded.
	let gap = false;
	for (let ofIndex = 0, ofList = callSites; ofIndex < ofList.length; ofIndex++) {
		const site = ofList[ofIndex];
		// An eval'd frame names the file it was evaluated from in its origin, as the formatted text does.
		const sourceURL = site.getScriptNameOrSourceURL?.() ?? null;
		const fileName = site.getFileName?.() ?? null;
		const location = sourceURL ?? fileName;
		if (skip > 0) {
			// A frame the walk would yield, passed over: whether a site has a location (or an eval origin) alone says that.
			if (location || (site.isEval?.() && String(site.getEvalOrigin?.() ?? ""))) {
				skip--;
				gap = false;
			} else gap = true;
			continue;
		}
		if (lean && location) {
			const described = runtime_comparableLocation(location);
			if (StringMethods.startsWith(described.path, FRAMEWORK_PREFIX)) {
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
	let described = MapMethods.get(COMPARABLE_LOCATIONS, location);
	if (described === undefined) {
		const path = toComparablePath(location);
		described = { path, key: runtime_scriptKey(path, location) };
		if (MapMethods.size(COMPARABLE_LOCATIONS) >= 4096) MapMethods.clear(COMPARABLE_LOCATIONS);
		MapMethods.set(COMPARABLE_LOCATIONS, location, described);
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

// The wrapper the vite plugin generates for a CommonJS helper calls into slothlet from the module vitest's or vite's
// runner evaluates for the helper: the call is taken on that module's own location (see requireCJSFromRunner).
setCallerCheck((entry) => runtime_registeredScript(entry, true)?.location ?? null);

/**
 * Add a script hash to a location's.
 * @param {string} key - The location's script key.
 * @param {string} hash - The hash.
 * @returns {void}
 * @private
 */
function runtime_rememberScript(key, hash) {
	let hashes = MapMethods.get(SCRIPT_HASHES, key);
	if (!hashes) MapMethods.set(SCRIPT_HASHES, key, (hashes = []));
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
	const learned = MapMethods.get(SCRIPT_HASHES, key);
	const loaded = loadedScriptLookup(key, hash);
	return {
		known: Boolean(learned?.length) || loaded.known,
		has: (hash !== undefined && Boolean(learned == null ? undefined : ArrayMethods.includes(learned, hash))) || loaded.has
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
	return MapMethods.size(SCRIPT_HASHES);
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
function forgetInstanceScripts(instanceID) {
	if (instanceID == null) return;
	for (const key of mapKeys(SCRIPT_HASHES)) if (scriptKeyInstance(key) === String(instanceID)) MapMethods.delete(SCRIPT_HASHES, key);
	for (const location of setValues(runtime_commonJSLocations(instanceID))) SetMethods.add(RETIRED_COMMONJS, location);
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
		const hashes = setFrom([sha256(source), sha256(text)]);
		if (source[0] === 0xef && source[1] === 0xbb && source[2] === 0xbf) SetMethods.add(hashes, sha256(source.subarray(3)));
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
	if (
		MapMethods.get(RUNNER_SNAPSHOT.scripts, frame.path) == null
			? undefined
			: SetMethods.has(MapMethods.get(RUNNER_SNAPSHOT.scripts, frame.path), frame.hash)
	)
		return true;
	let known = MapMethods.get(FILE_SOURCE_HASHES, frame.path);
	if (known === undefined) {
		known = runtime_readFileSourceHashes(frame.path);
		if (MapMethods.size(FILE_SOURCE_HASHES) >= 4096) MapMethods.clear(FILE_SOURCE_HASHES);
		MapMethods.set(FILE_SOURCE_HASHES, frame.path, known);
	}
	if (SetMethods.has(known.hashes, frame.hash)) return true;
	// The file may have changed since it was read (an edit before a reload): it is read again only then.
	let mtimeMs;
	try {
		mtimeMs = nodeFs(FS_STAT, frame.path).mtimeMs;
	} catch {
		return false;
	}
	if (mtimeMs === known.mtimeMs) return false;
	const fresh = runtime_readFileSourceHashes(frame.path);
	MapMethods.set(FILE_SOURCE_HASHES, frame.path, fresh);
	return SetMethods.has(fresh.hashes, frame.hash);
}

/**
 * Whether a frame the frame placer placed by its plain path alone (a module's folder, a CommonJS file) does not run
 * that file's own source (#597, #691): code compiled under a file name in a module's folder that is not there, or
 * whose source is something else. Such code is no module's, wherever it is read.
 * @param {{path: string, hash: string|null, key: string|null}} frame - A frame.
 * @param {{unverified?: boolean}|null} placement - What the placer answered for it.
 * @returns {boolean} True when the frame cannot be the code its placement names.
 * @internal
 */
export function isUnverifiedCode(frame, placement) {
	return Boolean(placement?.unverified) && !runtime_runsFileSource(frame) && !runtime_runsRunnerTransform(frame);
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
	for (let ofIndex = 0, ofList = frames; ofIndex < ofList.length; ofIndex++) {
		const frame = ofList[ofIndex];
		if (!frame.hash || !frame.key || runtime_knowsScript(frame.key).known) continue;
		seen ??= new Map();
		const hash = MapMethods.get(seen, frame.key);
		if (hash === undefined) MapMethods.set(seen, frame.key, frame.hash);
		else if (hash !== frame.hash) SetMethods.add((conflicts ??= new Set()), frame.key);
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
	let learnable = WeakMapMethods.get(LEARNABLE, fn);
	if (learnable === undefined) {
		try {
			learnable = !util.types.isProxy(fn) && !(RegExpMethods.exec(/\{\s*\[native code\]\s*\}\s*$/, functionSource(fn)) !== null);
		} catch {
			learnable = false;
		}
		WeakMapMethods.set(LEARNABLE, fn, learnable);
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
	if (!name || !StringMethods.includes(name, "slothlet_enter")) return null;
	if (RegExpMethods.exec(/\bslothlet_enterLeaf\b/, name) !== null) return "leaf";
	if (RegExpMethods.exec(/\bslothlet_enterCall\b/, name) !== null) return "call";
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
function enterCall(wrapper, fn, thisArg, args) {
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
	listPush(ENTERING, { wrapper, learnable: runtime_isLearnable(fn) });
	try {
		return Reflect.apply(fn, thisArg, args);
	} finally {
		ArrayMethods.pop(ENTERING);
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
 * The flows framework work runs in as the host (see {@link runAsHostWork}), each with the instance it is for: the store
 * of the flow, which only the context manager makes and no module code can reach.
 * @type {WeakMap<object, object>}
 * @private
 */
const HOST_WORK_STORES = new WeakMap();

/**
 * This file, in comparable form: where the frame of {@link slothlet_hostWork} runs.
 * @type {string}
 * @private
 */
const OWN_FILE = toComparablePath(URLMethods.href(new URL(import.meta.url)));

/**
 * Run framework work an instance does as the host (a reload's build, a restart's load, a run's copy) in the flow the
 * context manager opened for it: the flow's store is marked as that work's, and the work runs inside a frame of
 * {@link slothlet_hostWork}. Whose code makes a change while no call runs is read from the stack (see
 * {@link runtime_codeWritersOnStack}); in that flow, the frames past that one are the code that asked for the work, a
 * module's own function awaiting `self.slothlet.reload()` among them, and the work is not theirs. Code running inside the
 * work, nearer the stack's top, is still read as whoever's it is.
 * @param {object} slothlet - The instance.
 * @param {object|undefined} store - The flow's store, as the context manager reads it inside the flow.
 * @param {Function} fn - The work.
 * @returns {Promise<unknown>} Whatever `fn` resolves to.
 * @internal
 */
function runAsHostWork(slothlet, store, fn) {
	if (store && typeof store === "object") WeakMapMethods.set(HOST_WORK_STORES, store, slothlet);
	return slothlet_hostWork(fn);
}

/**
 * The frame framework work an instance does as the host runs inside ({@link runAsHostWork}): awaited, so it stays on
 * the stack (as an async frame) for as long as the work runs.
 * @param {Function} fn - The work.
 * @returns {Promise<unknown>} Whatever `fn` resolves to.
 * @private
 */
async function slothlet_hostWork(fn) {
	return await fn();
}

/**
 * Whether a frame is the one framework work runs inside ({@link slothlet_hostWork}): a frame of that function, in this
 * file, running this file's own source. A frame that only names the function, in code compiled by someone, is not.
 * @param {{head?: string, path: string, evaluated?: boolean, hash: string|null, key: string|null}} frame - A frame.
 * @returns {boolean} True when it is.
 * @private
 */
function runtime_isHostWorkFrame(frame) {
	if (frame.path !== OWN_FILE || frame.evaluated || !frame.head) return false;
	if (RegExpMethods.exec(/\bslothlet_hostWork$/, frame.head) === null) return false;
	return !isForeignScript(frame) && (runtime_runsFileSource(frame) || runtime_runsRunnerTransform(frame));
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
		if (frame.enter !== "leaf" || !StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) continue;
		const entering = ENTERING[ENTERING.length - 1 - depth++];
		const own = frames[index - 1];
		if (!entering?.learnable || frame.gap || !own?.hash || !own.key || StringMethods.startsWith(own.path, FRAMEWORK_DIR + "/")) continue;
		// A run build's script is recognised for as long as its seal is held (see `SEALED_BUILDS` in
		// helpers/instance-imports): learning it too would keep it past that, and push the location's other scripts out.
		if (loadedScriptLookup(own.key, own.hash).stamp != null) continue;
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
		(description.comparablePath && StringMethods.endsWith(path, "/" + description.comparablePath)) ||
		path === description.realComparablePath ||
		(description.locations == null ? undefined : SetMethods.has(description.locations, path))
	) {
		return true;
	}
	const cache = wrapper.slothlet?.handlers?.apiCacheManager;
	if (!cache) return false;
	return ArrayMethods.some(
		runtime_moduleRoots(cache),
		({ moduleID, root }) => moduleID === description.moduleID && StringMethods.startsWith(path, root + "/")
	);
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
	const text = StringMethods.trim(String(line));
	let head = "";
	let location;
	if (StringMethods.startsWith(text, "at ")) {
		if (StringMethods.endsWith(text, ")")) {
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
			head = StringMethods.slice(text, 0, open);
			location = StringMethods.slice(text, open + 1, -1);
		} else {
			location = regExpReplace(/^at (?:async )?/, text, "");
		}
	} else {
		let at = -1;
		for (let ofIndex = 0, ofList = matchAllOf(text, /@(?=[a-z][a-z0-9+.-]*:|\/)/gi); ofIndex < ofList.length; ofIndex++) {
			const match = ofList[ofIndex];
			at = match.index;
		}
		if (at < 0) return null;
		head = StringMethods.slice(text, 0, at);
		location = StringMethods.slice(text, at + 1);
	}
	return { head, path: toComparablePath(regExpReplace(/:\d+(?::\d+)?$/, location, "")) };
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
export const FRAMEWORK_DIR = toComparablePath(URLMethods.href(new URL("../../", import.meta.url)));

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
function describeCall(wrapper) {
	// A live wrapper always carries its internals, file and api path; the fallbacks describe a partial one
	// (a direct caller's stand-in) as having no file. The hints cover only the `??` fallbacks.
	const internal = wrapper?.____slothletInternal;
	const impl = internal?.impl;
	const filePath = /* v8 ignore next */ internal?.filePath ?? null;
	const apiPath = /* v8 ignore next */ internal?.apiPath ?? "";
	const cached = WeakMapMethods.get(DESCRIPTIONS, wrapper);
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
		fnName:
			typeof apiPath === "string"
				? StringMethods.slice(apiPath, StringMethods.lastIndexOf(apiPath, ".") + 1)
				: copyList(apiPath, StringMethods.lastIndexOf(apiPath, ".") + 1),
		// The names the function goes by on a stack: its api key, and its own name when that differs.
		fnNames: runtime_entryNames(apiPath, wrapper)
	};
	WeakMapMethods.set(DESCRIPTIONS, wrapper, { impl, filePath, description });
	return description;
}

/**
 * The module root folders of some instances' api caches, longest first.
 *
 * Taken from each instance's module cache — the folder every `base`/`api.add()` module was loaded from —
 * so a frame in any file of a module's folder can be attributed to that module, not only a frame in the
 * exact file its call entered through. Synthetic (in-memory) modules have no folder and contribute
 * nothing. Longest first so a module mounted from inside another module's folder owns its own files.
 *
 * @param {Array<object>} caches - The api caches of the calls being placed, each once.
 * @returns {Array<{moduleID: string, root: string}>} Module roots, longest first.
 * @private
 */
function runtime_moduleRootsOf(caches) {
	// One instance's roots are kept between reads as they are; several instances' are merged, deepest first.
	if (caches.length === 1) return runtime_moduleRoots(caches[0]);
	const roots = [];
	for (let i = 0; i < caches.length; i++) appendList(roots, runtime_moduleRoots(caches[i]));
	return ArrayMethods.sort(roots, (a, b) => b.root.length - a.root.length);
}

/**
 * Candidate indexes by the list of calls they were built for.
 * @type {WeakMap<ArrayLike<object>, object>}
 * @private
 */
const CANDIDATE_INDEXES = new WeakMap();

/**
 * A new empty list with no prototype, for lists of slothlet's own entries kept inside slothlet's own code: an element is
 * written to it as `list[list.length] = value` without any check, as nothing a module puts on `Array.prototype` or
 * `Object.prototype` is on its chain. Read by index and length only (it has no iterator).
 * @returns {Array<object>} The list.
 * @internal
 */
export function bareList() {
	return Objects.setPrototypeOf([], null);
}

/**
 * The entries of a list for which `keep` answers true, in a {@link bareList}; the list itself when it keeps all of them.
 * @param {ArrayLike<object>} list - The entries, only read.
 * @param {function(object): boolean} keep - The test.
 * @returns {ArrayLike<object>} The entries kept.
 * @private
 */
function keepAll(list, keep) {
	let at = 0;
	while (at < list.length && keep(list[at])) at++;
	if (at === list.length) return list;
	const kept = bareList();
	for (let i = 0; i < at; i++) kept[i] = list[i];
	for (let i = at + 1; i < list.length; i++) if (keep(list[i])) kept[kept.length] = list[i];
	return kept;
}

/**
 * Add an entry to the bare list kept under a key.
 * @param {Map<unknown, Array<object>>} map - The index.
 * @param {unknown} key - The key.
 * @param {object} entry - The entry.
 * @returns {Array<object>} The list.
 * @private
 */
function fileUnder(map, key, entry) {
	let list = MapMethods.get(map, key);
	if (!list) MapMethods.set(map, key, (list = bareList()));
	list[list.length] = entry;
	return list;
}

/**
 * What placing a frame among a list of calls needs from the calls alone, built once per list and kept with it.
 *
 * The calls are looked up by their files instead of each being compared to each frame: by comparable path (a relative
 * one as a whole-segment suffix of a location), by real path and by imported location, and by module. What a call's
 * file and a frame's tags select is kept too, by location and tags, so a list read again places the same frames by a
 * lookup. Only what the calls themselves describe is kept here: what an instance has loaded, which grows, is read
 * when a frame is placed. The lists it answers are slothlet's own and shared between reads, so they are only read.
 *
 * @param {ArrayLike<object>} candidates - The calls, each with a file. The list is not changed afterwards.
 * @returns {object} The index.
 * @private
 */
function runtime_candidateIndex(candidates) {
	let index = WeakMapMethods.get(CANDIDATE_INDEXES, candidates);
	if (index) return index;
	// Comparable paths that are strings, matched equal and as a suffix; any other only as the suffix its text makes.
	const byComparable = new Map();
	const bySuffixOnly = new Map();
	const byLocation = new Map();
	const byModule = new Map();
	const families = new Set();
	const caches = new Set();
	const loaders = new Set();
	const wrappers = new Set();
	// The lists the last entry was filed under: an entry of the same call of the same instance (overlapping calls of
	// one function) is filed under the same ones.
	let last = null;
	let lastLists = bareList();
	for (let i = 0; i < candidates.length; i++) {
		const entry = candidates[i];
		if (
			last !== null &&
			entry.currentWrapper === last.currentWrapper &&
			entry.family === last.family &&
			entry.comparablePath === last.comparablePath &&
			entry.realComparablePath === last.realComparablePath &&
			entry.locations === last.locations &&
			entry.moduleID === last.moduleID
		) {
			for (let j = 0; j < lastLists.length; j++) lastLists[j][lastLists[j].length] = entry;
			continue;
		}
		last = entry;
		lastLists = bareList();
		// An entry is filed once per list, even under keys that coincide (a real path also recorded as a location).
		const file = (map, key) => {
			const list = MapMethods.get(map, key);
			if (list && list[list.length - 1] === entry) return;
			lastLists[lastLists.length] = fileUnder(map, key, entry);
		};
		const comparable = entry.comparablePath;
		if (typeof comparable === "string") file(byComparable, comparable);
		else file(bySuffixOnly, `${comparable}`);
		if (entry.realComparablePath != null) file(byLocation, entry.realComparablePath);
		if (entry.locations != null) SetMethods.forEach(entry.locations, (location) => file(byLocation, location));
		file(byModule, entry.moduleID);
		if (frameFamilyOf(entry)) SetMethods.add(families, frameFamilyOf(entry));
		// The calls of one function share its wrapper: its instance's cache and loader are read once.
		const wrapper = entry.currentWrapper;
		if (SetMethods.has(wrappers, wrapper)) continue;
		SetMethods.add(wrappers, wrapper);
		// Every candidate is a live wrapper, which always reaches its instance's cache and loader; the chains guard a
		// partially-built wrapper handed in by a direct caller.
		const cache = wrapper?.slothlet?.handlers?.apiCacheManager;
		/* v8 ignore else */
		if (cache) SetMethods.add(caches, cache);
		const loader = wrapper?.slothlet?.processors?.loader;
		/* v8 ignore else */
		if (loader) SetMethods.add(loaders, loader);
	}

	// Entries of several lists, once each, in the order of the candidates.
	let order = null;
	const merged = (lists) => {
		if (order === null) {
			order = new Map();
			for (let i = 0; i < candidates.length; i++) if (!MapMethods.has(order, candidates[i])) MapMethods.set(order, candidates[i], i);
		}
		const seen = new Set();
		const list = bareList();
		for (let i = 0; i < lists.length; i++)
			for (let j = 0; j < lists[i].length; j++) {
				const entry = lists[i][j];
				if (SetMethods.has(seen, entry)) continue;
				SetMethods.add(seen, entry);
				list[list.length] = entry;
			}
		if (list.length > 1) ArrayMethods.sort(list, (a, b) => MapMethods.get(order, a) - MapMethods.get(order, b));
		return list;
	};

	// The calls a location is the file of. A browser-mode wrapper records its file relative to the manifest root, so a
	// relative path matches as a whole-segment suffix of a location; an absolute one must be equal. A file reached
	// through a symlink is matched by its real path too, as Node reports it.
	const atLocation = new Map();
	const entriesAt = (location) => {
		let found = MapMethods.get(atLocation, location);
		if (found) return found;
		const lists = bareList();
		const take = (list) => {
			if (list) lists[lists.length] = list;
		};
		take(MapMethods.get(byComparable, location));
		take(MapMethods.get(byLocation, location));
		for (let at = StringMethods.indexOf(location, "/"); at !== -1; at = StringMethods.indexOf(location, "/", at + 1)) {
			const suffix = StringMethods.slice(location, at + 1);
			take(MapMethods.get(byComparable, suffix));
			take(MapMethods.get(bySuffixOnly, suffix));
		}
		found = lists.length === 0 ? bareList() : lists.length === 1 ? lists[0] : merged(lists);
		MapMethods.set(atLocation, location, found);
		return found;
	};

	// The calls a frame in a call's own file is placed among, by its location and the instance and mount tags it carries.
	const inFile = new Map();
	const fileMatches = (location, frameInstance, frameModule) => {
		const key = `${location}\u0000${frameInstance ?? ""}\u0000${frameModule ?? ""}`;
		let found = MapMethods.get(inFile, key);
		if (found) return found;
		found = keepAll(
			entriesAt(location),
			(entry) =>
				(!frameInstance || !frameFamilyOf(entry) || frameFamilyOf(entry) === frameInstance) &&
				(frameModule ? entry.moduleID === frameModule : !frameInstance || !entry.moduleID)
		);
		MapMethods.set(inFile, key, found);
		return found;
	};

	index = {
		merged,
		entriesAt,
		fileMatches,
		families,
		caches: setToArray(caches),
		loaders: setToArray(loaders),
		ofModule: (moduleID) => MapMethods.get(byModule, moduleID) ?? bareList()
	};
	WeakMapMethods.set(CANDIDATE_INDEXES, candidates, index);
	return index;
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
 * What the calls alone decide is indexed once per list (see runtime_candidateIndex): a caller placing frames among the
 * same calls again passes the same list, unchanged, and places them by lookups. The `matches` lists placements answer
 * can be shared between placements, so they are only read.
 *
 * @param {Array<{currentWrapper: object, family: string|null, comparablePath: string, realComparablePath: string|null, locations: Set<string>|null, moduleID: string|null}>} candidates - The calls, each with a file.
 * @returns {{place: function(object): ({matches: Array<object>, byFile: boolean, byModule?: boolean}|null), families: Set<string>}}
 *   `place` answers a frame's placement — `{ matches }` (possibly none: an orphan), or null when the frame is
 *   no instance's code and in no module's folder; `byFile` marks a frame in a call's own file, whose
 *   function name may pin one of several. `families` are the instances the calls belong to.
 * @internal
 */
function createFramePlacer(candidates) {
	const index = runtime_candidateIndex(candidates);
	const { families, entriesAt } = index;
	const roots = runtime_moduleRootsOf(index.caches);

	// The CommonJS helpers each instance's leaves required run under their plain path, untagged; a frame
	// in one of them is that instance's code all the same. Node loads a CommonJS file once, so several
	// instances built from one folder share it: a path maps to every instance that required it.
	const commonJSFamiliesAt = (location) => {
		let found;
		for (const family of setValues(families)) {
			if (SetMethods.has(runtime_commonJSLocations(family), location)) SetMethods.add((found ??= new Set()), family);
		}
		return found;
	};

	// The files that import a file of an instance, transitively, and the file itself.
	const importersOf = (family, location) => {
		const graph = runtime_importGraph(family);
		const seen = setFrom([location]);
		const queue = [location];
		while (queue.length) {
			for (const importer of setValues(MapMethods.get(graph, ArrayMethods.pop(queue)))) {
				if (!SetMethods.has(seen, importer)) {
					SetMethods.add(seen, importer);
					listPush(queue, importer);
				}
			}
		}
		return seen;
	};

	// The files the candidates' instances loaded under their tag: every leaf, and every file of their import
	// graphs. The sets are cached across reads and rebuilt only when their instance loads more.
	let tagged = null;
	const isInstanceFile = (location) => {
		if (!tagged)
			tagged = concatLists(
				mapList(index.loaders, runtime_loadedLocations),
				mapList(setToArray(families), (family) => runtime_importGraphEntry(family).files)
			);
		return ArrayMethods.some(tagged, (set) => SetMethods.has(set, location));
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
		// A leaf's file an api file imported itself is no leaf's: it is placed as a helper file of the module is.
		const copy = runtime_leafFileCopyOf(frame) !== null;
		const byFile = copy ? bareList() : index.fileMatches(frame.path, frameInstance, frameModule);
		if (byFile.length) return { matches: byFile, byFile: true };
		const commonJSFamilies = frameInstance ? null : commonJSFamiliesAt(frame.path);
		const frameFamilies = frameInstance ? setFrom([frameInstance]) : commonJSFamilies;
		if (frameFamilies) {
			// A helper copy loaded for one api file (`helpers: "module"`) names it: only that file's calls can be running it.
			const loadedFor = frameInstance ? runtime_helperCopyOf(frameInstance, frame) : null;
			let owners;
			if (loadedFor)
				owners = keepAll(
					entriesAt(loadedFor.path),
					(entry) =>
						SetMethods.has(frameFamilies, frameFamilyOf(entry)) &&
						// A leaf's own copy names its mount: only that mount's calls can be running it.
						(!frameModule || entry.moduleID === frameModule) &&
						(!loadedFor.mount || entry.moduleID === loadedFor.mount)
				);
			else {
				// The calls of the frame's instances whose files import it.
				const lists = bareList();
				for (const family of setValues(frameFamilies)) {
					if (!SetMethods.has(families, family)) continue;
					for (const importer of setValues(importersOf(family, frame.path))) {
						const list = keepAll(
							entriesAt(importer),
							(entry) => frameFamilyOf(entry) === family && (!frameModule || entry.moduleID === frameModule)
						);
						if (list.length) lists[lists.length] = list;
					}
				}
				owners = lists.length === 0 ? bareList() : lists.length === 1 ? lists[0] : index.merged(lists);
			}
			// A CommonJS file runs under its plain path, which code compiled by someone can name too (#597).
			return { matches: owners, byFile: false, unverified: Boolean(commonJSFamilies) };
		}
		// A helper vitest's runner loaded for a leaf (slothlet itself run by the runner, so Node's loader never saw the
		// import): the leaves its record names as importers, directly or through other such helpers (#714).
		if (!frameInstance) {
			const importers = runtime_runnerTaggedImporters(frame.path);
			if (importers.length) {
				const lists = bareList();
				for (let i = 0; i < importers.length; i++) {
					const importer = importers[i];
					const list = keepAll(
						entriesAt(importer.location),
						(entry) => importer.family === frameFamilyOf(entry) && (!importer.mount || importer.mount === entry.moduleID)
					);
					if (list.length) lists[lists.length] = list;
				}
				if (lists.length) return { matches: lists.length === 1 ? lists[0] : index.merged(lists), byFile: false, unverified: true };
			}
		}
		// A CommonJS file only a gone instance loaded: its code is accounted for by no live call.
		if (isNode && !frameInstance && SetMethods.has(RETIRED_COMMONJS, frame.path)) return { matches: [], byFile: false };
		const owner = ArrayMethods.find(roots, ({ root }) => StringMethods.startsWith(frame.path, root + "/"));
		if (owner)
			return {
				matches: index.ofModule(owner.moduleID),
				byFile: false,
				byModule: true,
				unverified: true
			};
		return null;
	};

	return { place, families };
}

/**
 * The calls of lists grouped by the names their entry function goes by, and the answers already given for a frame's
 * text, by the list.
 * @type {WeakMap<ArrayLike<object>, {groups: Array<{names: *, entry: object, list: Array<object>}>, byHead: Map<string, ArrayLike<object>>}>}
 * @private
 */
const NAMED_AMONG = new WeakMap();

/**
 * The calls of a list whose entry function a stack frame's text names (see {@link runtime_namesEntry}).
 *
 * Calls of one function go by the same names, so the list is grouped by them once and each group's names are tested
 * once; a list read again (a placement's matches, a caller's candidates) answers for the same frame text by a lookup.
 * The list is only read, and the answer may be the list itself or shared, so it is only read too.
 *
 * @param {ArrayLike<{fnNames?: string[], fnName?: string}>} list - The calls. The list is not changed afterwards.
 * @param {string} head - The frame's text before its location.
 * @returns {ArrayLike<object>} The calls the frame names, in the list's order.
 * @internal
 */
export function runtime_namedAmong(list, head) {
	if (!head) return bareList();
	let known = WeakMapMethods.get(NAMED_AMONG, list);
	if (!known) {
		// Entries of one wrapper share its names list; an entry with no list goes by its single name.
		const byNames = new Map();
		const groups = bareList();
		for (let i = 0; i < list.length; i++) {
			const entry = list[i];
			const names = entry.fnNames ?? entry.fnName;
			let group = MapMethods.get(byNames, names);
			if (!group) {
				MapMethods.set(byNames, names, (group = { names, entry, list: bareList() }));
				groups[groups.length] = group;
			}
			group.list[group.list.length] = entry;
		}
		WeakMapMethods.set(NAMED_AMONG, list, (known = { groups, byHead: new Map() }));
	}
	let named = MapMethods.get(known.byHead, head);
	if (named) return named;
	const { groups } = known;
	let hit = null;
	let hits = 0;
	const verdicts = new Map();
	for (let i = 0; i < groups.length; i++) {
		const verdict = runtime_namesEntry(head, groups[i].entry);
		MapMethods.set(verdicts, groups[i].names, verdict);
		if (verdict) {
			hits++;
			hit = groups[i];
		}
	}
	if (hits === 0) named = bareList();
	else if (hits === groups.length) named = list;
	else if (hits === 1) named = hit.list;
	else named = keepAll(list, (entry) => MapMethods.get(verdicts, entry.fnNames ?? entry.fnName));
	MapMethods.set(known.byHead, head, named);
	return named;
}

/**
 * Whether a frame is one the microtask runner puts below a resumed function: a resumed function has
 * nothing of its own below it. Node also drains the microtask queue between the callbacks of one timer list and of
 * the immediate queue, so a function resumed there has the timers' own frames (`listOnTimeout`, `processTimers`,
 * `processImmediate`) below the runner's. While async hooks are enabled (on Node 22 by any `AsyncLocalStorage` in use,
 * slothlet's own included; on any version by `async_hooks.createHook()`), Node calls those queues through
 * `callbackTrampoline` as well, which is one more of Node's own frames below them. That frame counts only when its
 * script hashes as Node's own.
 * @param {{path: string, head: string, hash?: string|null}} frame - A frame.
 * @returns {boolean} True for a runner frame.
 * @internal
 */
export function isRunnerFrame(frame) {
	return (
		StringMethods.startsWith(frame.path, "node:internal/process/task_queues") ||
		frame.path === "node:internal/timers" ||
		RegExpMethods.exec(/\b(?:processTicksAndRejections|runMicrotasks)\b/, frame.head) !== null ||
		(frame.path === "node:internal/async_hooks" &&
			RegExpMethods.exec(/\bcallbackTrampoline\b/, frame.head) !== null &&
			runtime_isNodeScript(frame))
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
	const absolute = StringMethods.startsWith(comparable, "/");
	const segments = [];
	for (let ofIndex = 0, ofList = splitText(comparable, "/"); ofIndex < ofList.length; ofIndex++) {
		const segment = ofList[ofIndex];
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			if (segments.length && segments[segments.length - 1] !== "..") ArrayMethods.pop(segments);
			else if (!absolute) listPush(segments, segment);
			continue;
		}
		listPush(segments, segment);
	}
	const collapsed = (absolute ? "/" : "") + ArrayMethods.join(segments, "/");
	const spellings = [];
	// An empty root (or `/`) would own every absolute path; it owns nothing.
	if (collapsed && collapsed !== "/") listPush(spellings, collapsed);
	const real = runtime_realComparablePath(root);
	if (real && real !== collapsed) listPush(spellings, real);
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
function stackHoldsInstanceCode(sources) {
	const families = setFrom(mapList(sources, ({ family }) => family));
	const locations = [];
	const roots = [];
	for (let ofIndex = 0, ofList = sources; ofIndex < ofList.length; ofIndex++) {
		const { family, slothlet, roots: building } = ofList[ofIndex];
		listPush(locations, runtime_commonJSLocations(family), runtime_importGraphEntry(family).files);
		const loader = slothlet?.processors?.loader;
		if (loader) listPush(locations, runtime_loadedLocations(loader));
		const cache = slothlet?.handlers?.apiCacheManager;
		if (cache)
			for (let ofIndex = 0, ofList = runtime_moduleRoots(cache); ofIndex < ofList.length; ofIndex++) {
				const { root } = ofList[ofIndex];
				listPush(roots, root);
			}
		for (let ofIndex = 0, ofList = building; ofIndex < ofList.length; ofIndex++) {
			const root = ofList[ofIndex];
			appendList(roots, runtime_rootSpellings(root));
		}
	}
	const holds = (frames) => {
		for (const frame of framesOf(frames)) {
			if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) continue;
			const tag = runtime_frameInstanceTag(frame.line);
			if (tag && SetMethods.has(families, tag)) return true;
			if (ArrayMethods.some(locations, (set) => SetMethods.has(set, frame.path))) return true;
			if (ArrayMethods.some(roots, (root) => StringMethods.startsWith(frame.path, root + "/"))) return true;
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
function setApiValueCheck(check, harborsCode = null) {
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
function setResultAttributor(attributor) {
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
function attributeResult(wrapper, value, callerIsHost = false, caller = null, receiver = null) {
	return resultAttributor(wrapper, value, callerIsHost, caller, receiver);
}

/**
 * The call whose own code receives what a call returns, when that call was handed code (see
 * {@link supplierChainCeiling}): the parent call, when the code that made the call is the parent leaf's own (its
 * identity, as resolved for the call, is the parent's wrapper under the parent's own ceiling). Null when the parent was
 * handed no code, when code the parent was handed made the call, when that cannot be told (`provenance` off, an
 * identity left unresolved), or when the parent is not known. A stand-in made for what such a call returns is recorded
 * as handed to that call alone, until slothlet sees it handed anywhere else (see `runtime_originOf`).
 * @param {{wrapper?: object, flagged?: boolean, ceiling?: object|null}|null|undefined} parent - The call that made the
 *   call.
 * @param {{currentWrapper?: object|null, ceiling?: object|ReadonlyArray<object>|null, unresolved?: boolean}|null|undefined} identity -
 *   The identity the call was made with.
 * @returns {object|null} The parent's record, or null.
 * @internal
 */
function ownReceiver(parent, identity) {
	if (!parent?.flagged || !identity || identity.unresolved || !parent.wrapper) return null;
	if (!WeakSetMethods.has(trustedRootOwn.genuineWrappers, parent.wrapper)) return null;
	// With `provenance` off no frames are read, so code the parent was handed is not told from the parent's own.
	if (parent.wrapper.slothlet?.config?.permissions?.caller?.provenance === false) return null;
	if (identity.currentWrapper !== parent.wrapper || (identity.ceiling ?? null) !== (parent.ceiling ?? null)) return null;
	return parent;
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
function setHostPrototypeCheck(check) {
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
function setHandedOutCheck(check) {
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
function setInboundOriginal(unwrap) {
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
 * code (#597): the instance's `permissions.search.depth`, or the default for an instance with no `permissions` config.
 * Read as a plain number on every call.
 * @param {object|null|undefined} slothlet - The instance.
 * @returns {number} The levels.
 * @private
 */
const searchDepth = (slothlet) => slothlet?.config?.permissions?.search?.depth ?? DEFAULT_SEARCH_DEPTH;

/**
 * How many own properties, all values of one call counted together, plain data may have before it is treated
 * as able to carry code (#597): the instance's `permissions.search.properties`, or the default. Bounds what
 * deciding costs for a large argument.
 * @param {object|null|undefined} slothlet - The instance.
 * @returns {number} The properties.
 * @private
 */
const searchProperties = (slothlet) => slothlet?.config?.permissions?.search?.properties ?? DEFAULT_SEARCH_PROPERTIES;

/**
 * Whether a value is plain data, which can run none of the caller's code when a leaf converts, reads or walks
 * it: a primitive, one of slothlet's own api values, or a frozen non-Proxy object whose prototype is
 * `Object.prototype`, `Array.prototype` or `null` and whose own properties are all data properties holding plain
 * data — within the instance's `permissions.search` ({@link searchDepth}, {@link searchProperties}).
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
	if (WeakSetMethods.has(trustedRootOwn.genuineWrappers, value)) return true;
	if (isApiValue(value)) return !apiValueHarborsCode(value);
	if (typeof value === "function" || depth <= 0 || !isNode || util.types.isProxy(value)) return false;
	try {
		if (!Objects.isFrozen(value)) return false;
		const prototype = Objects.getPrototypeOf(value);
		if (prototype !== Objects.prototype && prototype !== Arrays.prototype && prototype !== null) return false;
		// A frozen array's `length` is an own data property: reading it runs nothing.
		if (prototype === Arrays.prototype && Arrays.isArray(value) && value.length > budget.remaining) return false;
		const keys = Reflect.ownKeys(value);
		budget.remaining -= keys.length;
		if (budget.remaining < 0) return false;
		for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
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
 * @param {*} raw - A receiver or an argument.
 * @param {{remaining: number}} budget - Properties still allowed for the call (see {@link runtime_isPlainData}).
 * @param {number} depth - Levels of objects allowed (see {@link searchDepth}).
 * @returns {boolean} True for an object or function that is neither slothlet's own nor plain data.
 * @private
 */
const carriesCode = (raw, budget, depth) => {
	// A module's view of a caller's value (an inbound or crossing view) stands for what the caller handed.
	const value = raw !== null && (typeof raw === "object" || typeof raw === "function") ? inboundOriginal(raw) : raw;
	return (
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		!WeakSetMethods.has(trustedRootOwn.genuineWrappers, value) &&
		!runtime_isPlainData(value, depth, budget)
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
 * @param {object|null} [slothlet=null] - The instance the call is made in, whose `permissions.search` bounds the search.
 * @returns {boolean} True when the call is to be checked for supplied code.
 * @internal
 */
export function carriesCallerCode(thisArg, args, slothlet = null) {
	const budget = { remaining: searchProperties(slothlet) };
	const depth = searchDepth(slothlet);
	if (carriesCode(thisArg, budget, depth)) return true;
	// The arguments are the trap's own array, never the caller's object, so reading them runs nothing.
	const count = args?.length ?? 0;
	for (let index = 0; index < count; index++) if (carriesCode(args[index], budget, depth)) return true;
	return false;
}

/**
 * The api nodes whose own leaf functions a call is handed as values (#597): a receiver or an argument that is a leaf
 * function slothlet wraps — imported raw from its file instead of read from `self` — or one held in plain data the
 * call is handed, within the instance's `permissions.search` ({@link searchDepth}, {@link searchProperties}). A leaf
 * function nested deeper than that, or past the property budget, is not found. Each is gated for the caller as
 * though it had called it through `self`.
 *
 * Decided from `typeof`, a registry lookup and property descriptors, so nothing of the caller's runs: a Proxy is not
 * looked into, an accessor is not read, and a function hidden behind either (or bound, so it is another function)
 * is not recognised.
 *
 * @param {*} thisArg - The call's receiver.
 * @param {ArrayLike<*>|null|undefined} args - The call's arguments.
 * @param {object|null} [slothlet=null] - The instance whose modules' copies of its leaf files count as well (see
 *   {@link leafOfCopy}), and whose `permissions.search` bounds the search.
 * @returns {Array<object>|null} The wrappers, or null when there are none.
 * @internal
 */
function handedLeafFunctions(thisArg, args, slothlet = null) {
	let found = null;
	const budget = { remaining: searchProperties(slothlet) };
	const visit = (value, depth) => {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
		// A module's view of a caller's value holds what the caller handed: that is what is looked into.
		value = inboundOriginal(value);
		if (typeof value === "function") {
			// A module's copy of a leaf's function (see leafOfCopy) is the leaf's function as well.
			const wrapper = WeakMapMethods.get(trustedRootOwn.implWrappers, value) ?? (slothlet === null ? null : leafOfCopy(slothlet, value));
			if (wrapper) listPush((found ??= []), wrapper);
			return;
		}
		if (
			depth <= 0 ||
			budget.remaining <= 0 ||
			WeakSetMethods.has(trustedRootOwn.genuineWrappers, value) ||
			isApiValue(value) ||
			!isNode ||
			util.types.isProxy(value)
		)
			return;
		try {
			const prototype = Objects.getPrototypeOf(value);
			if (prototype !== Objects.prototype && prototype !== Arrays.prototype && prototype !== null) return;
			if (prototype === Arrays.prototype && Arrays.isArray(value) && value.length > budget.remaining) return;
			const keys = Reflect.ownKeys(value);
			budget.remaining -= keys.length;
			if (budget.remaining < 0) return;
			for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
				if (descriptor && Objects.hasOwn(descriptor, "value")) visit(descriptor.value, depth - 1);
			}
		} catch {
			// An exotic object that refuses to be read holds nothing that can be found without running its code.
		}
	};
	const depth = searchDepth(slothlet);
	visit(thisArg, depth);
	const count = args?.length ?? 0;
	for (let index = 0; index < count; index++) visit(args[index], depth);
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
 * running inside the call may be code those calls handed in, however it got there (bound, behind a getter or a Proxy,
 * nested in data, kept from an earlier call), so it runs under all of them: returning a closure to a module lends that
 * module nothing it can pass on. The one exception is a stand-in slothlet handed to the call's own code and has seen
 * handed nowhere else, run by that code (see {@link outerCallerCeiling}).
 * @param {{parent?: object|null, flagged?: boolean}|null|undefined} record - The call.
 * @returns {object|ReadonlyArray<object>|null} The suppliers as a ceiling, or null when the call was handed no code
 *   by a module.
 * @internal
 * @example
 * combineCeilings(leaf, supplierChainCeiling(record));
 */
function supplierChainCeiling(record) {
	const parts = [];
	for (let current = record, depth = 0; current?.flagged && current.parent && depth < MAX_CHAIN; current = current.parent, depth++) {
		if (current.parent.wrapper && WeakSetMethods.has(trustedRootOwn.genuineWrappers, current.parent.wrapper))
			listPush(parts, current.parent.wrapper);
		if (current.parent.ceiling) listPush(parts, current.parent.ceiling);
	}
	return parts.length ? Reflect.apply(combineCeilings, undefined, parts) : null;
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
 * The ceiling is the leaf the code is running inside. With `permissions.caller.ceiling: "chain"` it is cumulative instead: the
 * leaf, every call between it and the supplier (the supplier's code runs inside each of them), and every ceiling
 * those calls and the supplier's own call already carried, so a nested resolution cannot shed one an earlier
 * resolution imposed.
 *
 * @param {{wrapper: object, parent: object|null, flagged: boolean, ceiling?: object|null, unaccountedCaller?: boolean}|null|undefined} record - The running call.
 * @param {Iterable<object>|null} [capture=null] - A capture of the stack taken at this same point, inside slothlet's own
 *   code, by a caller that read it already: read first instead of a capture of its own (see
 *   runtime_foreignCodeRunning).
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|{unaccounted: true}|null} The supplier's wrapper and
 *   the ceiling it runs under when it is a call above the leaf, `{unaccounted: true}` for code no call accounts for,
 *   otherwise null (the leaf's own code is running).
 * @internal
 */
function resolveSupplier(record, capture = null) {
	// Code a file started while it loaded: its module is the caller, and the code doing the access is told by its frames.
	if (record?.topLevel)
		return WeakSetMethods.has(trustedRootOwn.genuineWrappers, record.wrapper) && runtime_guardsForeignCode(record)
			? runtime_topLevelRunning(record)
			: null;
	// Code a module handed out, run through the stand-in recording its definer: the stack names the definer wherever it
	// can, and the record stands only where it cannot (#726).
	if (record?.made && WeakSetMethods.has(trustedRootOwn.genuineWrappers, record.wrapper) && runtime_guardsForeignCode(record)) {
		const told = runtime_madeCodeDefiner(record);
		if (told !== undefined) return told;
	}
	if (!record?.flagged)
		return runtime_guardsForeignCode(record) && WeakSetMethods.has(trustedRootOwn.genuineWrappers, record.wrapper)
			? runtime_foreignCodeRunning(record, capture)
			: null;
	const leaf = record.wrapper;
	if (!WeakSetMethods.has(trustedRootOwn.genuineWrappers, leaf)) return null;
	if (!record.parent?.wrapper) {
		if (record.unaccountedCaller) return runtime_unaccountedInside(record);
		return runtime_guardsForeignCode(record) ? runtime_foreignCodeRunning(record, capture) : null;
	}
	const chain = [];
	const seen = setFrom([leaf]);
	// The call that made the leaf's: what an unattributable frame is taken to be.
	let fallback = null;
	const leafDescription = describeCall(leaf);
	// A leaf the host added as an object or a function has no file of its own (#717): it is its own entity, at its path,
	// whatever file its function was written in. No frame is placed on it; inside its call, only code its caller handed
	// in runs as the caller (see runtime_isFilelessLeafCode).
	const fileless = runtime_isHostObjectLeaf(leaf, leafDescription.filePath);
	if (!fileless && leafDescription.filePath)
		listPush(chain, { ...leafDescription, currentWrapper: leaf, family: runtime_builtUnder(leaf), distance: 0, record });
	let current = record.parent;
	for (let depth = 1; current && depth < MAX_CHAIN; depth++, current = current.parent) {
		const wrapper = current.wrapper;
		if (!wrapper || SetMethods.has(seen, wrapper) || !WeakSetMethods.has(trustedRootOwn.genuineWrappers, wrapper)) continue;
		SetMethods.add(seen, wrapper);
		fallback ??= { currentWrapper: wrapper, record: current };
		const description = describeCall(wrapper);
		// A call with no file (an in-memory module) has no frames of its own to be placed on.
		if (!description.filePath) continue;
		listPush(chain, {
			...description,
			currentWrapper: wrapper,
			family: runtime_builtUnder(wrapper),
			distance: chain.length,
			record: current
		});
	}
	// No call of a module's above it (only the host's): read as a call with no parent is, so another module's code
	// running inside it is still told by its frames (#726).
	if (!fallback) {
		if (record.unaccountedCaller) return runtime_unaccountedInside(record);
		return runtime_guardsForeignCode(record) ? runtime_foreignCodeRunning(record, capture) : null;
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
		for (const frame of framesOf(frames)) {
			listPush(range, frame);
			if ((frame.enter && StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) || frame.async || isRunnerFrame(frame))
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
			if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) continue;
			if (frame.async || isRunnerFrame(frame)) break;
			// Code compiled by someone, under whatever location it chose: it cannot be anyone's own.
			if (frame.evaluated || isForeignScript(frame) || (conflicts == null ? undefined : SetMethods.has(conflicts, frame.key)))
				return fallback;
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
				if (
					guards &&
					placement &&
					(authored = runtime_authorAnswer(
						record,
						frame,
						typeof range === "string" ? StringMethods.slice(range, index + 1) : copyList(range, index + 1)
					))
				)
					return AUTHORED;
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
				if (
					guards &&
					placement.byFile &&
					!leafSeen &&
					(authored = runtime_siblingAuthor(
						record,
						frame,
						typeof range === "string" ? StringMethods.slice(range, index + 1) : copyList(range, index + 1)
					))
				)
					return AUTHORED;
				leafSeen = true;
				continue;
			}
			let nearest = null;
			for (let ofIndex = 0, ofList = matches; ofIndex < ofList.length; ofIndex++) {
				const match = ofList[ofIndex];
				if (match.currentWrapper !== leaf && (!nearest || match.distance < nearest.distance)) nearest = match;
			}
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
		if (answer === undefined)
			answer = ArrayMethods.some(deeper.range, (frame) => !StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) ? leaf : fallback;
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
	for (const frame of framesOf(frames)) {
		position++;
		if (position <= index) continue;
		if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
			if (frame.enter) {
				if (!throughOwnEntry || passedCode) break;
				throughOwnEntry = false;
			}
			continue;
		}
		passedCode = true;
		if (frame.async || isRunnerFrame(frame)) break;
		if (frame.evaluated || StringMethods.startsWith(frame.path, "node:") || isForeignScript(frame)) continue;
		// A leaf's file an api file loaded itself is no leaf's (see runtime_leavesAt).
		const leaves = slothlet
			? runtime_leavesAt(slothlet, frame)
			: runtime_leafFileCopyOf(frame)
				? []
				: runtime_leavesAtLocation(frame.path, frame.line);
		if (!leaves?.length) continue;
		for (
			let ofIndex = 0, ofList = runtime_narrowToLeaf(leaves, frame, runtime_framesAfter(frames, position));
			ofIndex < ofList.length;
			ofIndex++
		) {
			const caller = ofList[ofIndex];
			SetMethods.add(callers, caller);
		}
	}
	return setToArray(callers);
}

/**
 * Who is doing an access made from something a file started while it loaded (a timer, a listener, a queue): the file's
 * module is the caller, and the code nearest the access that is not slothlet's, Node's, a package's or the host's own
 * decides whose code it is: a package's code and the host's act for the code that called them, as inside a call, and
 * past 1024 frames of such code the access is refused. Code outside every export of the module's file and a
 * helper file it imports run as the module, and so do a package's and the host's when nothing else called them. Code
 * written inside an export (of this file or another module's) runs as that leaf, its definer, under the
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
	// The nodes built from the module's file, read when a package's frame is met.
	let ownLeaves = null;
	// A helper file's own code running in the flow with no code of a leaf's file calling it (what the helper started when
	// it loaded): the module's, and, where other api files import the helper too, theirs as well. The helper is loaded
	// once, inside whichever load imported it first, so the flow carries that load's module alone; every module importing
	// the helper has to be allowed.
	const helperFlow = (helper) => {
		const others = filterList(runtime_helperModules(helper), (other) => other !== module);
		return others.length
			? { wrapper: module, ceiling: Reflect.apply(combineCeilings, undefined, concatLists([record.ceiling ?? null], others)) }
			: null;
	};
	const decide = (frames) => {
		let index = -1;
		// Whether the entry slothlet made for this flow itself was passed with no code of anyone's before it: the flow
		// was re-entered (the live runtime's pin) by code further out, which is then what is asked about.
		let passedOwnEntry = false;
		let passedCode = false;
		// The helper file the module imports that the innermost code runs in, while the walk looks for the code that
		// called it.
		let helper = null;
		for (const frame of framesOf(frames)) {
			index++;
			if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
				if (frame.enter) {
					if (passedOwnEntry || passedCode) return helper ? helperFlow(helper) : null;
					passedOwnEntry = true;
				}
				continue;
			}
			passedCode = true;
			if (frame.async || isRunnerFrame(frame)) return helper ? helperFlow(helper) : null;
			if (frame.evaluated || isForeignScript(frame)) return UNACCOUNTED_SUPPLIER;
			// Node's own code acts for whoever called it: the next frame out decides.
			if (StringMethods.startsWith(frame.path, "node:")) {
				if (runtime_isNodeScript(frame)) continue;
				return UNACCOUNTED_SUPPLIER;
			}
			const leaves = runtime_leavesAt(slothlet, frame);
			if (leaves.length) {
				if (!runtime_runsFileSource(frame) && !runtime_runsRunnerTransform(frame)) return UNACCOUNTED_SUPPLIER;
				// The helper's code was called by this file's: it runs for it only when the file imports the helper.
				if (helper && !runtime_importsHelper(helper, leaves)) return UNACCOUNTED_SUPPLIER;
				const definers = runtime_narrowToLeaf(leaves, frame, runtime_framesAfter(frames, index));
				// Every leaf whose code is further out on the stack is a caller too: the code ran through them. So is every
				// module importing a helper whose own flow the code runs in.
				const callers = filterList(
					concatLists(runtime_outerCallers(frames, index, slothlet, true), runtime_outerHelperModules(frames, index, slothlet)),
					(caller) => caller !== module && caller !== definers[0]
				);
				if (definers.length === 1 && definers[0] === module && !callers.length) return null;
				return {
					wrapper: definers[0],
					ceiling: Reflect.apply(combineCeilings, undefined, concatLists([module, record.ceiling ?? null], copyList(definers, 1), callers))
				};
			}
			if (helper) {
				// Further out than the helper's code is the helper's own again, or code of no leaf's file (the host's, a
				// package's): no leaf's code called the helper.
				if (runtime_helperOwner(frame, slothlet)) continue;
				return helperFlow(helper);
			}
			const placement = filePath ? place(frame) : null;
			if (placement?.matches.length) {
				// A file the module imports that no leaf was built from: a helper, whose code runs for whoever called it.
				helper = runtime_helperOwner(frame, slothlet);
				if (helper) continue;
				return null;
			}
			// A package's code, or the host's, acts for the code that called it, as inside a call: the next frame out decides
			// (see runtime_foreignCodeRunning). A browser cannot tell such a frame from any other, and reads past it too.
			if (!placement) {
				// A package the file loads is the module's own, whichever of the file's nodes stands for the load (a lazy tree's
				// module node is the folder's, the file's leaves are the file's).
				ownLeaves ??= runtime_loadedFileLeaves(slothlet, record.file ?? filePath, entry.moduleID);
				const answer = isNode ? runtime_packageAnswer(record, frame, false, ownLeaves) : null;
				if (answer === null) continue;
				return answer;
			}
			// Code of the instance the module does not import. A helper file's own code is the code of the api files that
			// import it, under this flow's module too: a helper waiting on a module with a top-level await is evaluated when
			// that module is ready, in the flow of the file that started loading it, so the flow a helper's timer carries is
			// not always its importer's. (Slothlet's own runtime, which awaits too, is loaded before any api file.)
			return runtime_helperAnswer(record, frame) ?? UNACCOUNTED_SUPPLIER;
		}
		if (frames.truncated) return undefined;
		return helper ? helperFlow(helper) : null;
	};
	const answer = decide(runtime_captureFrames(48));
	if (answer !== undefined) return answer;
	// Cut off with the stack going on: read further out, and when that still reaches no one's code (a package recursing
	// past it, say) nothing says whose access it is. The flow is the module's, so it is refused as the module's flow,
	// not left for a node the module read to settle as code no call accounts for.
	const far = decide(runtime_captureFrames(FAR_FRAMES));
	return far === undefined ? REFUSED_SUPPLIER : far;
}

/**
 * The nodes built from the file a load is for (see {@link runtime_topLevelRunning}).
 * @param {object} slothlet - The instance.
 * @param {string|null} filePath - The file.
 * @param {string|null} moduleID - The mount it is loaded for.
 * @returns {Array<object>} The nodes, none without a file.
 * @private
 */
function runtime_loadedFileLeaves(slothlet, filePath, moduleID) {
	if (!filePath) return [];
	const leaves = runtime_leavesAtFile(slothlet, toComparablePath(filePath), null, moduleID || null);
	const real = runtime_realComparablePath(filePath);
	return real && real !== toComparablePath(filePath)
		? concatLists(leaves, runtime_leavesAtFile(slothlet, real, null, moduleID || null))
		: leaves;
}

/**
 * The modules importing the helper files whose own code is on the synchronous stack further out than a frame (#726):
 * code run from what a helper file started when it loaded (its queue, its timer) runs in a flow every module importing
 * the helper shares, so all of them are its callers. The walk ends where the synchronous stack does, or at a call
 * slothlet entered.
 * @param {Iterable<object>} frames - The capture, innermost first.
 * @param {number} index - The index of the frame the helpers are further out than.
 * @param {object} slothlet - The instance.
 * @returns {Array<object>} The modules' wrappers, none when no helper's code is further out.
 * @private
 */
function runtime_outerHelperModules(frames, index, slothlet) {
	const modules = new Set();
	const seen = new Set();
	let position = -1;
	let passedOwnEntry = false;
	let passedCode = false;
	for (const frame of framesOf(frames)) {
		position++;
		if (position <= index) continue;
		if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
			if (frame.enter) {
				if (passedOwnEntry || passedCode) break;
				passedOwnEntry = true;
			}
			continue;
		}
		passedCode = true;
		if (frame.async || isRunnerFrame(frame)) break;
		if (frame.evaluated || StringMethods.startsWith(frame.path, "node:") || isForeignScript(frame) || SetMethods.has(seen, frame.path))
			continue;
		SetMethods.add(seen, frame.path);
		const helper = runtime_helperOwner(frame, slothlet);
		if (helper)
			for (let ofIndex = 0, ofList = runtime_helperModules(helper); ofIndex < ofList.length; ofIndex++) {
				const module = ofList[ofIndex];
				SetMethods.add(modules, module);
			}
	}
	return setToArray(modules);
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
	// Slothlet's own frames are passed over by their path and what they enter alone, so they are read no further.
	for (const frame of framesOf(!Arrays.isArray(frames) && typeof frames.lean === "function" ? frames.lean() : frames)) {
		index++;
		if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
			if (frame.enter) return undefined;
			continue;
		}
		if (frame.async || isRunnerFrame(frame) || frame.evaluated || isForeignScript(frame)) return undefined;
		// Node's own code reads values for whoever called it: the next frame out decides.
		if (StringMethods.startsWith(frame.path, "node:") && runtime_isNodeScript(frame)) continue;
		if (!runtime_runsFileSource(frame) && !runtime_runsRunnerTransform(frame)) return undefined;
		const leaves = runtime_leavesAt(recorded.slothlet, frame);
		if (!leaves.length) return undefined;
		const definers = runtime_narrowToLeaf(leaves, frame, runtime_framesAfter(frames, index));
		if (ArrayMethods.includes(definers, recorded)) return null;
		return {
			wrapper: definers[0],
			ceiling: Reflect.apply(combineCeilings, undefined, concatLists([record.ceiling ?? null], copyList(definers, 1)))
		};
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
	if (leaves.length < 2 || !ArrayMethods.includes(leaves, leaf)) return null;
	const source = runtime_sourceOf(leaf.____slothletInternal.filePath, frame);
	if (!source) return null;
	// The nearest frame of the file inside an export names the code's leaf; the leaf's own module node holds none.
	let holder = runtime_leafHolding(leaves, source, frame);
	for (let ofIndex = 0, ofList = holder ? [] : outer; ofIndex < ofList.length; ofIndex++) {
		const further = ofList[ofIndex];
		if (!runtime_sameFileFrame(further, frame)) break;
		if ((holder = runtime_leafHolding(leaves, source, further))) break;
	}
	if (!holder || holder === leaf) return null;
	// A leaf nested in the entered one (a member of a callable node) is the entered leaf's own code.
	const own = String(leaf.____slothletInternal.apiPath ?? "");
	if (StringMethods.startsWith(String(holder.____slothletInternal.apiPath ?? ""), own + ".")) return null;
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
	if (typeof filePath !== "string" || !StringMethods.startsWith(filePath, "synthetic:")) return false;
	const internal = leaf.____slothletInternal;
	const { ownership, apiManager } = leaf.slothlet.handlers;
	// A synthetic leaf always carries the moduleID of the add that built it, and its instance its handlers; the guard
	// covers a partial wrapper handed in by a direct caller.
	/* v8 ignore if */
	if (!internal?.moduleID || !ownership || !apiManager) return false;
	// The deepest of its module's mounts that holds it, and the mounter recorded for it: null for host code, the module's
	// id for a module's own add.
	const segments = splitText(internal.apiPath, ".");
	const holds = (endpoint) => ArrayMethods.every(filterList(splitText(endpoint, "."), Boolean), (part, index) => segments[index] === part);
	const mount = ArrayMethods.sort(filterList(ownership.getModuleMounts(internal.moduleID), holds), (a, b) => b.length - a.length)[0];
	return mount !== undefined && MapMethods.get(apiManager.mountedBy, apiManager.mountKey(internal.moduleID, mount)) === null;
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
	if (!StringMethods.includes(frame.path, "/node_modules/") && SetMethods.size(runtime_packageImportingLeaves(leaf.slothlet, frame.path)))
		return false;
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
	if (!StringMethods.includes(frame.path, "/node_modules/") || isInstanceOwnerFile(leaf.slothlet, frame.path)) return false;
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
	return concatLists(importers, MapMethods.get(RUNNER_SNAPSHOT.importers, path) ?? [], VITE_LOADED_REGISTRY?.importersOf(path) ?? []);
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
	const seen = setFrom([path]);
	const queue = [path];
	while (queue.length && SetMethods.size(seen) <= PACKAGE_WALK) {
		for (
			let ofIndex = 0, ofList = MapMethods.get(RUNNER_SNAPSHOT.importers, ArrayMethods.shift(queue)) ?? [];
			ofIndex < ofList.length;
			ofIndex++
		) {
			const id = ofList[ofIndex];
			if (typeof id !== "string") continue;
			const location = toComparablePath(id);
			const query = splitText(id, "?")[1] ?? "";
			const family = queryParam(query, "slothlet_instance");
			if (family) listPush(found, { family, mount: queryParam(query, "module"), location });
			else if (!SetMethods.has(seen, location)) {
				SetMethods.add(seen, location);
				listPush(queue, location);
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
	const seen = setFrom([path]);
	const queue = [path];
	// The instance's own files reached: each is a leaf's, or a helper of the leaves importing it.
	const reached = [];
	while (queue.length && SetMethods.size(seen) <= PACKAGE_WALK) {
		for (let ofIndex = 0, ofList = runtime_fileImporters(ArrayMethods.shift(queue)); ofIndex < ofList.length; ofIndex++) {
			const importer = ofList[ofIndex];
			const query = splitText(importer, "?")[1] ?? "";
			const location = toComparablePath(importer);
			const instance = queryParam(query, "slothlet_instance");
			// A module's copy of any instance names the module's file: an untagged file is loaded once per process, by
			// whichever instance came first, and is the same module's code for every instance built from that file.
			if (instance) {
				listPush(reached, { location, tagged: true, mount: queryParam(query, "module") });
				continue;
			}
			// A file the instance runs under its plain path (a CommonJS leaf, or one of its helpers) carries no tag to match.
			if (
				SetMethods.has(commonJS, location) ||
				(WeakMapMethods.get(LEAF_FILES, slothlet) == null ? undefined : MapMethods.has(WeakMapMethods.get(LEAF_FILES, slothlet), location))
			) {
				listPush(reached, { location, tagged: false, mount: null });
				continue;
			}
			if (!SetMethods.has(seen, location)) {
				SetMethods.add(seen, location);
				listPush(queue, location);
			}
		}
	}
	for (let ofIndex = 0, ofList = reached; ofIndex < ofList.length; ofIndex++) {
		const { location, tagged, mount } = ofList[ofIndex];
		const files = setFrom([location]);
		const walk = [location];
		while (walk.length && SetMethods.size(files) <= PACKAGE_WALK) {
			const file = ArrayMethods.shift(walk);
			// The file reached is matched by the tags its import carried; a file run under its plain path carries none, and
			// is no copy of a leaf's (#691) for that alone. The api files further up are named by path in the graph, not by
			// a URL.
			const own = runtime_leavesAtFile(slothlet, file, tagged && file === location ? family : null, mount);
			if (own.length) {
				for (let ofIndex = 0, ofList = own; ofIndex < ofList.length; ofIndex++) {
					const leaf = ofList[ofIndex];
					SetMethods.add(leaves, leaf);
				}
				continue;
			}
			for (const importer of setValues(MapMethods.get(graph, file))) {
				if (!SetMethods.has(files, importer)) {
					SetMethods.add(files, importer);
					listPush(walk, importer);
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
 * @param {Iterable<object>|null} [own=null] - Further wrappers whose loading the file counts as the call's own: a
 *   file's load, whose module node is not always one of the leaves its file was built from.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|{unaccounted: true}|null} The answer.
 * @private
 */
function runtime_packageAnswer(record, frame, fileless, own = null) {
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
	if (!SetMethods.size(importers)) {
		if (runtime_isUnownedPackage(leaf, frame, false)) return UNACCOUNTED_SUPPLIER;
		return runtime_runsFileSource(frame) || runtime_runsOwnerTransform(leaf.slothlet, frame) || runtime_runsHostLoadedTransform(frame)
			? null
			: UNACCOUNTED_SUPPLIER;
	}
	if (SetMethods.has(importers, leaf)) return null;
	for (let i = 0, members = ceilingMembers(record.ceiling); i < members.length; i++) if (SetMethods.has(importers, members[i])) return null;
	if (own) for (let i = 0; i < own.length; i++) if (SetMethods.has(importers, own[i])) return null;
	const importerList = setToArray(importers);
	const first = importerList[0];
	const rest = copyList(importerList, 1);
	return {
		wrapper: first,
		ceiling: Reflect.apply(combineCeilings, undefined, concatLists([leaf, record.ceiling, supplierChainCeiling(record)], rest))
	};
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
const PACKAGE_ENTRIES = setFrom(
	mapList(
		["index.mjs", "index.cjs"],
		(file) => `${StringMethods.slice(FRAMEWORK_DIR, 0, StringMethods.lastIndexOf(FRAMEWORK_DIR, "/"))}/${file}`
	)
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
	if (MapMethods.has(PACKAGE_ROOTS, path)) return MapMethods.get(PACKAGE_ROOTS, path);
	let root = null;
	for (
		let dir = StringMethods.slice(path, 0, StringMethods.lastIndexOf(path, "/"));
		dir;
		dir = StringMethods.slice(dir, 0, StringMethods.lastIndexOf(dir, "/"))
	) {
		if (nodeFs(FS_EXISTS, `${dir}/package.json`)) {
			root = dir;
			break;
		}
	}
	if (MapMethods.size(PACKAGE_ROOTS) >= 4096) MapMethods.clear(PACKAGE_ROOTS);
	MapMethods.set(PACKAGE_ROOTS, path, root);
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
function recordInstanceOwner(slothlet) {
	if (!isNode) return;
	for (const frame of framesOf(runtime_captureFrames(32))) {
		if (
			StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/") ||
			StringMethods.startsWith(frame.path, "node:") ||
			SetMethods.has(PACKAGE_ENTRIES, frame.path)
		)
			continue;
		if (frame.evaluated) return;
		const root = runtime_packageRootOf(frame.path);
		if (root) WeakMapMethods.set(OWNER_PACKAGES, slothlet, root);
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
function isInstanceOwnerFile(slothlet, path) {
	const owner = WeakMapMethods.get(OWNER_PACKAGES, slothlet);
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
	if (!MapMethods.has(PACKAGE_NAMES, root)) {
		let name = null;
		try {
			const parsed = JSON_PARSE(nodeFs(FS_READ_FILE, `${root}/package.json`, "utf8"));
			if (typeof parsed?.name === "string") name = parsed.name;
		} catch {
			// A manifest that cannot be read or parsed names no package.
		}
		MapMethods.set(PACKAGE_NAMES, root, name);
	}
	return MapMethods.get(PACKAGE_NAMES, root);
}

/**
 * The packages whose code evaluates the modules vite transformed: vitest's module runner and vite's own.
 * @type {Set<string>}
 * @private
 */
const VITE_RUNNERS = setFrom(["vitest", "vite"]);

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
 * The errors the registries captured themselves on being called by a registration (#714), from slothlet's own realm
 * (see `helpers/stack-read`), so the frames do not depend on the global `Error` and its stack settings: slothlet's own
 * frames sit on top, and the registering file's below them.
 * @type {WeakSet<object>}
 * @private
 */
const OWN_CAPTURES = new WeakSet();

/**
 * The frames of what registrations pushed before slothlet fixed the registry in place, read when it did (before any
 * module's code could run), by what was pushed.
 * @type {WeakMap<object, object|null>}
 * @private
 */
const EARLY_READS = new WeakMap();

/**
 * The frames of a registration's error, read with slothlet's own formatter, when its stack is still the engine's own
 * and unread; null otherwise.
 * @param {unknown} entry - What was pushed.
 * @returns {object|null} The frames (see {@link runtime_structuredFrames}), or null.
 * @private
 */
function runtime_registrationFrames(entry) {
	if (WeakMapMethods.has(EARLY_READS, entry)) return WeakMapMethods.get(EARLY_READS, entry);
	// An engine whose errors carry no `stack` getter cannot tell an unread stack from one a script wrote: nothing is taken.
	if (!PRISTINE_STACK_GET || !util.types.isNativeError(entry)) return null;
	if (!hasEngineStack(entry)) return null;
	const frames = readStack(
		(error, sites) => {
			const read = runtime_structuredFrames(error, sites);
			WeakSetMethods.add(READ_REGISTRATIONS, read);
			return read;
		},
		{ error: entry }
	)?.value;
	return WeakSetMethods.has(READ_REGISTRATIONS, frames) ? frames : null;
}

/**
 * The script a registration's error was created in, when the registration is genuine (#714): a native error whose
 * stack is still unread, created by a file's own top-level code — its first frame, compiled code with a script hash,
 * not code compiled from a string — that vitest's or vite's runner was evaluating: the next frame that is not Node's
 * own code is a file of the `vitest` or `vite` package running that file's own source. Code a module compiled with `vm` under a host file's name
 * and registered itself has its own frame, not the runner's, below it.
 * @param {unknown} entry - What was pushed.
 * @param {boolean} [called=false] - The error was created by slothlet's own code on being called, not by the file: the
 *   frames of slothlet's own at the top are passed over, and the file's is the first below them. Always so for an error
 *   a registry captured itself ({@link OWN_CAPTURES}).
 * @returns {{key: string, hash: string, location: string}|null} The script, with the location its frame names, or null.
 * @private
 */
function runtime_registeredScript(entry, called = false) {
	const frames = runtime_registrationFrames(entry);
	if (frames === null) return null;
	if (WeakSetMethods.has(OWN_CAPTURES, entry)) called = true;
	let own = null;
	let runner = null;
	for (const frame of framesOf(frames)) {
		if (!own) {
			if (called && StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) continue;
			own = frame;
			continue;
		}
		// Node's own code between them (the microtask queue a module resumes in after its imports) is passed over.
		if (StringMethods.startsWith(frame.path, "node:") && !frame.evaluated && runtime_isNodeScript(frame)) continue;
		runner = frame;
		break;
	}
	if (
		!own?.hash ||
		!own.key ||
		own.evaluated ||
		StringMethods.startsWith(own.path, FRAMEWORK_DIR + "/") ||
		StringMethods.startsWith(own.path, "node:")
	)
		return null;
	if (!runner?.hash || runner.evaluated || StringMethods.startsWith(runner.path, "node:")) return null;
	const runnerRoot = runtime_packageRootOf(runner.path);
	if (!runnerRoot || !SetMethods.has(VITE_RUNNERS, runtime_packageName(runnerRoot)) || !runtime_runsFileSource(runner)) return null;
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
 * The frame budget of a registry's own capture: slothlet's frames, the registering file's and the runner's below it.
 * @type {number}
 * @private
 */
const REGISTRATION_FRAMES = 64;

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
function installViteHostRegistry(target) {
	const key = Symbols.for(VITE_HOST_SCRIPTS);
	const current = Objects.getOwnPropertyDescriptor(target, key);
	// Fixed by another copy of slothlet already: its reader answers for every copy.
	if (current && !current.configurable) return typeof current.value?.registered === "function" ? current.value : null;
	const queue = [];
	// What registrations pushed before slothlet loaded; a Proxy in its place is not read, as reading it would run its traps.
	// Their stacks are read now, before any module's code can change the global stack settings.
	if (Arrays.isArray(current?.value) && !util.types.isProxy(current.value)) {
		for (let i = 0; i < current.value.length; i++) {
			const entry = Objects.getOwnPropertyDescriptor(current.value, i)?.value;
			if (entry !== null && typeof entry === "object") WeakMapMethods.set(EARLY_READS, entry, runtime_registrationFrames(entry));
			listPush(queue, entry);
		}
	}
	/** @type {Map<string, Set<string>>} */
	const scripts = new Map();
	const registered = (scriptKey, hash) => {
		const pending = queue.length;
		for (let i = 0; i < pending; i++) {
			const script = runtime_registeredScript(Objects.getOwnPropertyDescriptor(queue, i)?.value);
			if (!script) continue;
			let hashes = MapMethods.get(scripts, script.key);
			if (!hashes) MapMethods.set(scripts, script.key, (hashes = new Set()));
			SetMethods.add(hashes, script.hash);
		}
		// What was read is dropped; anything pushed while reading stays for the next read.
		listSplice(queue, 0, pending);
		return (MapMethods.get(scripts, scriptKey) == null ? undefined : SetMethods.has(MapMethods.get(scripts, scriptKey), hash)) === true;
	};
	Objects.defineProperty(queue, "registered", {
		__proto__: null,
		value: Objects.freeze(registered),
		enumerable: false,
		writable: false,
		configurable: false
	});
	// A registration calls `push` on the registry from the file's own top-level code: what it hands over is not read, and
	// the registry captures the stack itself from slothlet's own realm, whatever the global stack settings hold.
	Objects.defineProperty(queue, "push", {
		__proto__: null,
		value: Objects.freeze(() => {
			const captured = unreadError(REGISTRATION_FRAMES);
			if (captured !== null) {
				WeakSetMethods.add(OWN_CAPTURES, captured);
				listPush(queue, captured);
			}
			return queue.length;
		}),
		enumerable: false,
		writable: false,
		configurable: false
	});
	Objects.defineProperty(target, key, { __proto__: null, value: queue, enumerable: false, writable: false, configurable: false });
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
	if (!Objects.isFrozen(entry)) return null;
	const message = Objects.getOwnPropertyDescriptor(entry, "message");
	return typeof message?.value === "string" ? runtime_loadedFrom(runtime_registeredScript(entry), message.value) : null;
}

/**
 * The record of who loaded a file, from the script that made it and the JSON of the importers' ids it gave: the script
 * has to be the top-level code of the virtual module the vite plugin writes for the file (see {@link runtime_loadedRecord}).
 * @param {{location: string}|null} script - The script, as {@link runtime_registeredScript} gives it.
 * @param {string} json - The JSON of the importers' ids.
 * @returns {{path: string, importers: Array<string>}|null} The file, in comparable form, and its importers, or null.
 * @private
 */
function runtime_loadedFrom(script, json) {
	const prefix = `\0${LOADED_BY_SPECIFIER}`;
	if (typeof script?.location !== "string" || !StringMethods.startsWith(script.location, prefix)) return null;
	const loaded = queryParam(StringMethods.slice(script.location, prefix.length), "id");
	if (!loaded) return null;
	let importers;
	try {
		importers = JSON_PARSE(json);
	} catch {
		return null;
	}
	if (!Arrays.isArray(importers)) return null;
	return { path: toComparablePath(loaded), importers: filterList(importers, (id) => typeof id === "string") };
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
function installViteLoadedRegistry(target) {
	const key = Symbols.for(VITE_LOADED_BY);
	const current = Objects.getOwnPropertyDescriptor(target, key);
	// Fixed by another copy of slothlet already: its reader answers for every copy.
	if (current && !current.configurable) return typeof current.value?.importersOf === "function" ? current.value : null;
	/** @type {Map<string, Set<string>>} */
	const records = new Map();
	let accepted = 0;
	const keep = (record) => {
		if (!record) return;
		accepted++;
		let importers = MapMethods.get(records, record.path);
		if (!importers) MapMethods.set(records, record.path, (importers = new Set()));
		for (let i = 0; i < record.importers.length; i++) SetMethods.add(importers, record.importers[i]);
	};
	// What records were pushed before slothlet loaded; a Proxy in its place is not read, as reading it would run its traps.
	if (Arrays.isArray(current?.value) && !util.types.isProxy(current.value)) {
		for (let i = 0; i < current.value.length; i++) keep(runtime_loadedRecord(Objects.getOwnPropertyDescriptor(current.value, i)?.value));
	}
	const registry = Objects.freeze({
		push: Objects.freeze((...entries) => {
			for (let i = 0; i < entries.length; i++) keep(runtime_loadedRecord(entries[i]));
			return 0;
		}),
		// The record a virtual module makes once slothlet fixed the registry: the JSON of the importers, with the stack
		// captured here from slothlet's own realm, whatever the global stack settings hold.
		record: Objects.freeze((json) => {
			if (typeof json !== "string") return;
			const captured = unreadError(REGISTRATION_FRAMES);
			if (captured === null) return;
			WeakSetMethods.add(OWN_CAPTURES, captured);
			keep(runtime_loadedFrom(runtime_registeredScript(captured), json));
		}),
		importersOf: Objects.freeze((path) => {
			const found = MapMethods.get(records, path);
			return found ? setMembers(found) : null;
		}),
		// How many records it accepted: the permission baseline's sign that the vite plugin is loaded.
		recorded: Objects.freeze(() => accepted)
	});
	Objects.defineProperty(target, key, { __proto__: null, value: registry, enumerable: false, writable: false, configurable: false });
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
	ArrayMethods.flatMap(
		[
			"__vite_ssr_exports__,__vite_ssr_import_meta__,__vite_ssr_import__,__vite_ssr_dynamic_import__,__vite_ssr_exportAll__,__vite_ssr_exportName__"
		],
		(ssr) => [ssr, `${ssr},__filename,__dirname,module,exports,require`]
	)
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
	for (let ofIndex = 0, ofList = mapValues(RUNNER_MODULES.idToModuleMap); ofIndex < ofList.length; ofIndex++) {
		const node = ofList[ofIndex];
		const file = typeof node?.file === "string" ? node.file : null;
		if (!file) continue;
		const path = toComparablePath(file);
		const code = node?.meta?.code;
		if (typeof code === "string") {
			let hashes = MapMethods.get(scripts, path);
			if (!hashes) MapMethods.set(scripts, path, (hashes = new Set()));
			for (let ofIndex = 0, ofList = RUNNER_PARAMETERS; ofIndex < ofList.length; ofIndex++) {
				const parameters = ofList[ofIndex];
				SetMethods.add(hashes, sha256(`'use strict';async (${parameters})=>{{${code}\n}}`));
			}
		}
		const ids = filterList(setMembers(node?.importers), (id) => typeof id === "string");
		if (ids.length) MapMethods.set(importers, path, concatLists(MapMethods.get(importers, path) ?? [], ids));
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
	for (let ofIndex = 0, ofList = outer; ofIndex < ofList.length; ofIndex++) {
		const candidate = ofList[ofIndex];
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
	for (let ofIndex = 0, ofList = running; ofIndex < ofList.length; ofIndex++) {
		const part = ofList[ofIndex];
		for (let m = 0, members = ceilingMembers(part); m < members.length; m++)
			if (members[m] && members[m] !== leaf) SetMethods.add(runners, members[m]);
	}
	for (const runner of setValues(runners)) {
		if (!WeakSetMethods.has(trustedRootOwn.genuineWrappers, runner)) return REFUSED_SUPPLIER;
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
 * file, all of them. A helper file's code, which no leaf was built from, is the code of the modules whose api files
 * import the helper (see {@link runtime_helperAnswer}). Null when neither names anyone, or the frame does not run the
 * file's own source.
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
	// Another copy of a file the instance loaded under its tag, which a package or the host imported itself: no leaf's
	// code, as frame placement reads it (see createFramePlacer).
	if (runtime_untaggedInstanceCopy(record.wrapper.slothlet, frame)) return null;
	// The nearest leaf frame of the file, or the file's module when no frame of it is inside a leaf's range (#726).
	// Read as far as each reader goes, once: the readers stop at the first frame of another file.
	const further = Arrays.isArray(outer) ? outer : runtime_replayable(outer);
	const authors = runtime_narrowToLeaf(runtime_leavesAt(record.wrapper.slothlet, frame), frame, further);
	// No leaf was built from the file: a helper file's own code is the code of the modules importing the helper.
	if (!authors.length) return runtime_helperAnswer(record, frame);
	// A leaf's own exported function, entered as it is: a call of that leaf's node by whoever runs it.
	if (authors.length === 1 && runtime_enteredAsItself(authors[0], frame, further))
		return runtime_leafCallAnswer(authors[0], [record.wrapper, record.ceiling, supplierChainCeiling(record)]);
	// Inside a call that was handed code, the calls that handed it down are held to as well (see supplierChainCeiling).
	return {
		wrapper: authors[0],
		ceiling: Reflect.apply(
			combineCeilings,
			undefined,
			concatLists([record.wrapper, record.ceiling, supplierChainCeiling(record)], copyList(authors, 1))
		)
	};
}

/**
 * Whether a frame runs in an untagged copy of a file an instance loaded under its tag. In Node slothlet loads every ES
 * module of an instance under its tag and knows its CommonJS files, so an untagged frame at such a file is another
 * copy of it, a package's or the host's own import: code no call accounts for, and no leaf's (see
 * {@link createFramePlacer}, which places such a frame on no call).
 * @param {object|null|undefined} slothlet - The instance.
 * @param {{path: string, line: string}} frame - The frame.
 * @returns {boolean} True when it is such a copy.
 * @private
 */
function runtime_untaggedInstanceCopy(slothlet, frame) {
	if (!isNode || !slothlet || typeof frame.line !== "string" || runtime_frameInstanceTag(frame.line)) return false;
	const leaves = runtime_leavesAtFile(slothlet, frame.path, null, null);
	if (!leaves.length) return false;
	for (let ofIndex = 0, ofList = leaves; ofIndex < ofList.length; ofIndex++) {
		if (SetMethods.has(runtime_commonJSLocations(runtime_builtUnder(ofList[ofIndex])), frame.path)) return false;
	}
	const loader = slothlet.processors?.loader;
	return Boolean(loader) && SetMethods.has(runtime_loadedLocations(loader), frame.path);
}

/**
 * Frames read from an iterable as they are first asked for, and replayed from there for every later walk.
 * @param {Iterable<object>} frames - The frames.
 * @returns {Iterable<object>} The same frames, in the same order, for any number of walks.
 * @private
 */
function runtime_replayable(frames) {
	const read = [];
	let source = null;
	let done = false;
	return {
		*[Symbol.iterator]() {
			for (let i = 0; ; i++) {
				if (i < read.length) {
					yield read[i];
					continue;
				}
				if (done) return;
				source ??= frames[Symbol.iterator]();
				const next = source.next();
				if (next.done) {
					done = true;
					return;
				}
				listPush(read, next.value);
				yield next.value;
			}
		}
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
	for (let i = StringMethods.indexOf(text, "\n"); i !== -1; i = StringMethods.indexOf(text, "\n", i + 1)) listPush(starts, i + 1);
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
		const known = MapMethods.get(FILE_SOURCES, scriptID);
		if (known) return known;
		const recorded = loadedScriptText(frame.key, frame.hash ?? null);
		if (typeof recorded === "string") {
			const source = runtime_asSource(recorded);
			if (MapMethods.size(FILE_SOURCES) >= 4096) MapMethods.clear(FILE_SOURCES);
			MapMethods.set(FILE_SOURCES, scriptID, source);
			return source;
		}
	}
	if (MapMethods.has(FILE_SOURCES, filePath)) return MapMethods.get(FILE_SOURCES, filePath);
	let source;
	try {
		// Under vite's module runner the file runs as the code vite transformed it into: its frames and its functions'
		// text are that code's, so the code is what ranges are read from (the runner's wrapper only prefixes line 1).
		let runnerCode = null;
		if (RUNNER_MODULES) {
			const comparable = toComparablePath(filePath);
			for (let ofIndex = 0, ofList = mapValues(RUNNER_MODULES.idToModuleMap); ofIndex < ofList.length; ofIndex++) {
				const node = ofList[ofIndex];
				if (typeof node?.file === "string" && typeof node?.meta?.code === "string" && toComparablePath(node.file) === comparable) {
					runnerCode = node.meta.code;
					break;
				}
			}
		}
		source = runtime_asSource(
			runnerCode ?? String(nodeFs(FS_READ_FILE, StringMethods.startsWith(filePath, "file:") ? new URL(filePath) : filePath, "utf8"))
		);
	} catch {
		// A file that cannot be read gives no ranges: its code is the file's module.
		source = null;
	}
	MapMethods.set(FILE_SOURCES, filePath, source);
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
		let held = MapMethods.get(names, exported);
		if (!held) MapMethods.set(names, exported, (held = new Set()));
		SetMethods.add(held, local);
	};
	const { text } = source;
	const entry = new RegExp(`^\\s*(${IDENTIFIER})(?:\\s+as\\s+(${IDENTIFIER}|"[^"]*"|'[^']*'))?\\s*$`);
	for (let ofIndex = 0, ofList = matchAllOf(text, /export\s*\{([^}]*)\}/g); ofIndex < ofList.length; ofIndex++) {
		const list = ofList[ofIndex];
		for (let ofIndex = 0, ofList = splitText(list[1], ","); ofIndex < ofList.length; ofIndex++) {
			const part = ofList[ofIndex];
			const named = RegExpMethods.exec(entry, part);
			if (named) add(regExpReplace(/^["']|["']$/g, named[2] ?? named[1], ""), named[1]);
		}
	}
	for (
		let ofIndex = 0, ofList = matchAllOf(text, new RegExp(`export\\s+default\\s+(${IDENTIFIER})\\s*(?:;|$)`, "gm"));
		ofIndex < ofList.length;
		ofIndex++
	) {
		const given = ofList[ofIndex];
		add("default", given[1]);
	}
	for (
		let ofIndex = 0, ofList = matchAllOf(text, new RegExp(`module\\.exports\\s*=\\s*(${IDENTIFIER})\\s*(?:;|$)`, "gm"));
		ofIndex < ofList.length;
		ofIndex++
	) {
		const given = ofList[ofIndex];
		add("default", given[1]);
	}
	for (
		let ofIndex = 0,
			ofList = matchAllOf(text, new RegExp(`(?:module\\.)?exports\\.(${IDENTIFIER})\\s*=\\s*(${IDENTIFIER})\\s*(?:;|$)`, "gm"));
		ofIndex < ofList.length;
		ofIndex++
	) {
		const given = ofList[ofIndex];
		add(given[1], given[2]);
	}
	const pair = new RegExp(`^\\s*(${IDENTIFIER})(?:\\s*:\\s*(${IDENTIFIER}))?\\s*$`);
	for (let ofIndex = 0, ofList = matchAllOf(text, /module\.exports\s*=\s*\{([^{}]*)\}/g); ofIndex < ofList.length; ofIndex++) {
		const literal = ofList[ofIndex];
		for (let ofIndex = 0, ofList = splitText(literal[1], ","); ofIndex < ofList.length; ofIndex++) {
			const part = ofList[ofIndex];
			const named = RegExpMethods.exec(pair, part);
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
	const before = regExpReplace(/[\s(]+$/, StringMethods.slice(text, Math.max(0, at - 160), at), "");
	for (const name of setValues(names)) {
		if (name === "default" && RegExpMethods.exec(/(?:export\s+default|module\.exports\s*=)$/, before) !== null) return true;
		// The name is matched as text: every character a pattern reads otherwise is escaped.
		const escaped = regExpReplace(/[\\^$.*+?()[\]{}|]/g, name, "\\$&");
		if (RegExpMethods.exec(new RegExp(`(?:^|[^\\w$])${escaped}\\s*[=:]$`), before) !== null) return true;
		if (RegExpMethods.exec(new RegExp(`^(?:async\\s+)?function\\s*\\*?\\s*${escaped}(?![\\w$])`), own) !== null) return true;
		if (RegExpMethods.exec(new RegExp(`^class\\s+${escaped}(?![\\w$])`), own) !== null) return true;
		if (RegExpMethods.exec(new RegExp(`^(?:static\\s+)?(?:async\\s+)?(?:get\\s+|set\\s+)?\\*?\\s*${escaped}\\s*\\(`), own) !== null)
			return true;
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
	const held = WeakMapMethods.get(LEAF_RANGES, leaf);
	if (held && held.source === source) return held.range;
	let range = null;
	const impl = leaf.____slothletInternal?.impl;
	if (typeof impl === "function") {
		try {
			const own = functionSource(impl);
			if (!StringMethods.endsWith(own, "{ [native code] }")) {
				const places = [];
				for (
					let at = StringMethods.indexOf(source.text, own);
					at !== -1 && places.length < 64;
					at = StringMethods.indexOf(source.text, own, at + 1)
				)
					listPush(places, at);
				if (places.length) {
					const exportPath = leaf.____slothletInternal.exportPath;
					const exported = Arrays.isArray(exportPath) && exportPath.length ? String(exportPath[exportPath.length - 1]) : null;
					const names = setFrom(
						exported === null ? [] : concatLists([exported], setToArray(MapMethods.get(runtime_exportLocals(source), exported)))
					);
					const declared = SetMethods.size(names) ? filterList(places, (at) => runtime_declaredAt(source.text, at, own, names)) : [];
					if (declared.length === 1) range = [declared[0], declared[0] + own.length];
					else if (!declared.length && places.length === 1) range = [places[0], places[0] + own.length];
				}
			}
		} catch {
			range = null;
		}
	}
	WeakMapMethods.set(LEAF_RANGES, leaf, { source, range });
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
function setModuleNodeResolver(resolver) {
	moduleNodeResolver = resolver;
}

/**
 * The api path of the module a file's leaves were built from: each leaf's path less its path inside the file's
 * exports, when they all agree (#726). Null when they do not, or when it is the root. A member of the file's default
 * export (`module.exports` of a CommonJS file, or an ES module's default object) sits on the module's node, as the
 * named exports do, so its path inside the exports is its path inside the default export.
 * @param {Array<object>} leaves - The leaves of one file.
 * @returns {string|null} The module path.
 * @private
 */
function runtime_moduleRootPath(leaves) {
	let root = null;
	for (let ofIndex = 0, ofList = leaves; ofIndex < ofList.length; ofIndex++) {
		const leaf = ofList[ofIndex];
		const internal = leaf.____slothletInternal;
		const recorded = internal.exportPath;
		if (!Arrays.isArray(recorded)) continue;
		const exportPath = recorded[0] === "default" ? copyList(recorded, 1) : recorded;
		if (!exportPath.length) continue;
		const segments = splitText(String(internal.apiPath ?? ""), ".");
		if (segments.length <= exportPath.length) return null;
		const path = ArrayMethods.join(copyList(segments, 0, segments.length - exportPath.length), ".");
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
	for (let ofIndex = 0, ofList = leaves; ofIndex < ofList.length; ofIndex++) {
		const leaf = ofList[ofIndex];
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
function runtime_framesAfter(frames, index) {
	// A capture of call sites converts only the frames from there.
	// An array is read by index alone: nothing is looked up on Array.prototype.
	if (!Arrays.isArray(frames) && typeof frames.after === "function") return frames.after(index);
	return generatorSteps(runtime_framesFrom(frames, index));
}

/**
 * The frames of a walk after the one at an index (see {@link runtime_framesAfter}).
 * @param {Iterable<object>} frames - The frames.
 * @param {number} index - The index of the frame they follow.
 * @returns {Generator<object>} The frames further out.
 * @private
 */
function* runtime_framesFrom(frames, index) {
	let i = 0;
	for (const frame of framesOf(frames)) if (i++ > index) yield frame;
}

/**
 * A walk of frames that reads nothing module code can replace: an array's elements by the array iterator's `next`
 * taken at load, and a capture's (or {@link runtime_framesAfter}'s) through the walk it hands out, which steps its
 * generator with the functions taken at load.
 * @param {Iterable<object>} frames - An array of frames, a capture, or frames further out.
 * @returns {Iterable<object>} The frames.
 * @private
 */
function framesOf(frames) {
	if (Arrays.isArray(frames)) return listSteps(frames);
	return frames[Symbol.iterator]();
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
	// The file the frame runs from: a lazy folder's node indexed at its only file has the folder as its own path.
	const filePath = (
		ArrayMethods.find(
			leaves,
			(leaf) => leaf.____slothletInternal.filePath && toComparablePath(leaf.____slothletInternal.filePath) === frame.path
		) ?? ArrayMethods.find(leaves, (leaf) => leaf.____slothletInternal.filePath)
	)?.____slothletInternal.filePath;
	const source = filePath ? runtime_sourceOf(filePath, frame) : null;
	if (!source) return leaves;
	let best = runtime_leafHolding(leaves, source, frame);
	if (!best) {
		for (const further of framesOf(outer)) {
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
	const paths = mapList(leaves, (leaf) => String(leaf.____slothletInternal.apiPath ?? ""));
	const module = ArrayMethods.find(leaves, (leaf, i) =>
		ArrayMethods.every(paths, (other) => other === paths[i] || StringMethods.startsWith(other, paths[i] + "."))
	);
	if (module) return [module];
	// A lazy tree's module node was built with no file: found by its path, the same node an eager tree builds for the file.
	const modulePath = runtime_moduleRootPath(leaves);
	if (modulePath === null || !ArrayMethods.every(paths, (path) => StringMethods.startsWith(path, modulePath + "."))) return leaves;
	// Leaves a restart replaced are not stood for by the rebuilt tree's node at their module's path: the code is theirs,
	// and has no standing (see runtime_taggedLeavesAtFile).
	if (leaves[0].slothlet.handlers?.apiManager?.isRestartReplaced?.(leaves[0])) return leaves;
	const node = moduleNodeResolver(leaves[0].slothlet, modulePath);
	const standing = node && WeakSetMethods.has(trustedRootOwn.genuineWrappers, node) && node.slothlet === leaves[0].slothlet;
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
function createModuleLoad(slothlet, filePath, moduleID) {
	let record = null;
	const loading = {
		slothlet,
		filePath,
		moduleID: moduleID ?? null,
		// The context the instance runs in now: a reload moves it to a new ID once that ID's context is set up.
		instanceID() {
			const instances = slothlet?.contextManager?.instances;
			if (!instances?.has) return null;
			const current = slothlet.instanceID;
			return current && MapMethods.has(instances, current) ? current : null;
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
 * instance is pending, and otherwise the first pending load whose file imports it. `false` when the code is a loading
 * instance's and no pending load imports its file; null when it is not a loading file's code.
 * @param {Iterable<{slothlet: object, filePath: string, moduleID: string|null}>} loads - The loads pending.
 * @returns {object|false|null} The load, false, or null.
 * @internal
 * @example
 * const loading = loadOnStack(pending); // the load whose file's top level is registering a timer
 */
function loadOnStack(loads) {
	for (const frame of framesOf(runtime_captureFrames(32))) {
		if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
			// A call slothlet entered is running: its code is the call's, not a load's.
			if (frame.enter) return null;
			continue;
		}
		if (StringMethods.startsWith(frame.path, "node:")) continue;
		if (frame.evaluated) return null;
		const tag = runtime_frameInstanceTag(frame.line);
		const mount = runtime_frameModuleTag(frame.line);
		const sameInstance = [];
		for (const loading of setValues(loads)) {
			const family = loading.slothlet?.instanceID;
			if (tag && family !== tag) continue;
			if (toComparablePath(loading.filePath) === frame.path || runtime_realComparablePath(loading.filePath) === frame.path) {
				if (!mount || !loading.moduleID || loading.moduleID === mount) return loading;
				continue;
			}
			if (tag) listPush(sameInstance, loading);
		}
		if (!sameInstance.length) return null;
		// A helper copy loaded for one api file (`helpers: "module"`) is evaluated by that file's load.
		const loadedFor = tag ? runtime_helperCopyOf(tag, frame) : null;
		if (loadedFor) {
			const own = filterList(
				sameInstance,
				(loading) =>
					(toComparablePath(loading.filePath) === loadedFor.path || runtime_realComparablePath(loading.filePath) === loadedFor.path) &&
					(!loadedFor.mount || !loading.moduleID || loading.moduleID === loadedFor.mount)
			);
			if (own.length) return own[0];
		}
		if (sameInstance.length === 1) return sameInstance[0];
		// A helper several loads may be evaluating: the load whose file imports it, when one alone does.
		const graph = runtime_importGraph(tag);
		const seen = setFrom([frame.path]);
		const queue = [frame.path];
		while (queue.length && SetMethods.size(seen) <= PACKAGE_WALK) {
			for (const importer of setValues(MapMethods.get(graph, ArrayMethods.pop(queue)))) {
				if (SetMethods.has(seen, importer)) continue;
				SetMethods.add(seen, importer);
				listPush(queue, importer);
			}
		}
		const importing = filterList(sameInstance, (loading) => SetMethods.has(seen, toComparablePath(loading.filePath)));
		// Several pending loads import it: the first stands for the flow, and every module importing the helper is held
		// to when the flow's code makes an access (see runtime_topLevelRunning).
		return importing.length ? importing[0] : false;
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
 * The instance ID the frames of a call's code carry, which a frame's tag is matched against: the ID the called node was
 * built under (see runtime_builtUnder) when the call says so, else the instance the call belongs to. They differ for a
 * call of a node a full reload is replacing, made while the reload builds its new copy or still in flight after it.
 * @param {{family?: string|null, builtUnder?: string|null}} entry - A call.
 * @returns {string|null|undefined} The ID.
 * @private
 */
function frameFamilyOf(entry) {
	return entry.builtUnder ?? entry.family;
}

/**
 * The instance ID a node was built under: the tag the code of its file carries in a stack frame, and the ID its
 * instance's import graph for that copy is kept under. A full reload gives the instance a new ID; the code of the copy
 * it replaced (a call still in flight, a timer it set) still carries the ID the instance had then.
 * @param {object} wrapper - A genuine wrapper.
 * @returns {string|null} The ID.
 * @private
 */
function runtime_builtUnder(wrapper) {
	return wrapper.____slothletInternal.builtUnder ?? wrapper.slothlet.instanceID;
}

/**
 * Whether one of the calls of a flow ran a node built under an instance ID (see {@link runtime_builtUnder}).
 * @param {ReadonlyArray<object>} owners - The calls' wrappers.
 * @param {string} id - The ID.
 * @returns {boolean} True when one did.
 * @private
 */
function runtime_builtUnderAny(owners, id) {
	for (let i = 0; i < owners.length; i++) {
		if (WeakSetMethods.has(trustedRootOwn.genuineWrappers, owners[i]) && runtime_builtUnder(owners[i]) === id) return true;
	}
	return false;
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
 * @param {object|null} [origin=null] - For a stand-in, the call it was handed to alone, when slothlet has seen it handed
 *   nowhere else (see {@link ownReceiver}): run by that call's own code, it is code the call obtained itself, not code a
 *   call above handed in, so the calls that handed code down are not its ceiling.
 * @returns {object|ReadonlyArray<object>|null} The ceiling.
 * @throws {SlothletError} PERMISSION_DENIED when who is running the code cannot be told while the permission system is on.
 * @internal
 */
function outerCallerCeiling(contextManager, instanceID, slothlet = null, origin = null) {
	const identity = contextManager?.getCallerIdentity?.(instanceID);
	if (!identity?.currentWrapper) {
		// Who runs it cannot be told (several calls are waiting and the stack names more than one, or none): it is no
		// one's, and not the host's either, so the code is not run under its definer's rights alone.
		if (identity?.unresolved && slothlet && runtime_checksPermissions(slothlet)) {
			// The engine reading a member of a value a promise is resolved with (its `then`) is no code running it: with
			// only slothlet's and Node's own frames on the stack, nothing runs the code, and it stays its definer's.
			let running = false;
			for (const frame of framesOf(runtime_captureFrames(FAR_FRAMES))) {
				if (
					!frame.evaluated &&
					(StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/") || StringMethods.startsWith(frame.path, "node:"))
				)
					continue;
				running = true;
				break;
			}
			if (!running) return null;
			throw new SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf("self") });
		}
		// No call says who runs it: the leaves whose code is on the stack do (a module running the code from a timer it
		// reached without slothlet's store or pin). Only read where the frames are (`provenance`), and never inside a
		// flow slothlet pinned to the host.
		if (identity?.unresolved || !slothlet || !runtime_guardsForeignCode({ wrapper: { slothlet } })) return null;
		if (typeof contextManager.isAmbient === "function" && !contextManager.isAmbient(instanceID)) return null;
		const callers = runtime_outerCallers(runtime_captureFrames(32), -1, slothlet);
		return callers.length ? Reflect.apply(combineCeilings, undefined, callers) : null;
	}
	// Run inside a call that was handed code, it may be code the caller handed in: the calls that handed code down are
	// its ceiling too (see supplierChainCeiling). A stand-in handed to this call alone, run by the call's own code, is
	// not (ID-D6).
	const own = origin !== null && identity.record === origin && ownReceiver(origin, identity) === origin;
	return combineCeilings(identity.currentWrapper, identity.ceiling ?? null, own ? null : supplierChainCeiling(identity.record));
}

/**
 * Whether what a module hands out and is handed is set up as that module's code (#597, #726): only while the
 * permission system of the wrapper's instance is on and `permissions.caller.attribution` is `"precise"` (the default). Then a
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
	return slothlet?.config?.permissions?.caller?.attribution !== "fast" && slothlet?.handlers?.permissionManager?.isEnabled?.() === true;
}

/**
 * Whether a module call's result is passed through {@link attributeResult} (#726): while the permission system of the
 * wrapper's instance is on, under either `permissions.caller.attribution`. `"precise"` hands out code as stand-ins there;
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
 * Whether an instance still has a context its code can run in: it is not shut down. A reload switches the instance to
 * its new ID only once that ID's context is set up.
 * @param {object} slothlet - The instance.
 * @returns {boolean} True while it runs.
 * @private
 */
function runtime_instanceRuns(slothlet) {
	const instances = slothlet?.contextManager?.instances;
	if (!instances?.has) return false;
	const current = slothlet.instanceID;
	return Boolean(current && MapMethods.has(instances, current));
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
 * @param {string|null} [location=null] - The location as the frame names it, query included: a frame carrying a mount's
 *   tag is held to the queries the instance's loader imported the file under.
 * @param {{hash?: string|null, key?: string|null}|null} [frame=null] - The frame, for the script it runs (see
 *   {@link runtime_runRestartReplacedLeaves}).
 * @returns {Array<object>|null} Leaves of one instance.
 * @private
 */
function runtime_leavesAtLocation(path, line, running = null, location = null, frame = null) {
	const tag = runtime_frameInstanceTag(line);
	const mount = runtime_frameModuleTag(line);
	let found = null;
	let instance = null;
	// What an instance that has shut down left behind: read only when no running instance holds the file.
	let gone = null;
	let goneInstance = null;
	// Whether more than one running instance holds the file: only the one whose flow is running is then read.
	let several = false;
	for (const ofEntry of mapEntries(LIVE_INSTANCES)) {
		const id = ofEntry[0],
			reference = ofEntry[1];
		if (tag && id !== tag) continue;
		const slothlet = WeakRefMethods.deref(reference);
		if (!slothlet) {
			MapMethods.delete(LIVE_INSTANCES, id);
			continue;
		}
		// What a shut-down instance made has no standing while its permission system was on; with it off the code is
		// still told apart, and runs as plain JavaScript, with no context to read `self` from (#726).
		const runs = runtime_instanceRuns(slothlet);
		if (!runs && runtime_checksPermissions(slothlet)) continue;
		const leaves = runtime_taggedLeavesAtFile(slothlet, path, tag, mount, location, runs, frame);
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
 * @returns {{wrapper: object, callers: Array<object>}|{leaves: Array<object>, callers: Array<object>}|{unplaced: true, shared?: true, foreign?: true}|null} The
 *   definer. `shared` marks code of a file more than one running instance holds, with nothing naming which; `foreign`
 *   code at an instance's file running in a script that is not the file's (see {@link isForeignScript}).
 * @internal
 */
function frameDefiner(running = null) {
	const frames = runtime_captureFrames(24);
	return runtime_holdDetachedJob(runtime_definerAt(frames, running), frames);
}

/**
 * Whether the code running now is not the code of the flow it runs in: a module's code that entered, by itself, a flow
 * the host or another module's call opened. Node's async context hands any code holding an async resource of a flow (an
 * `AsyncResource`, a function `AsyncLocalStorage.snapshot()` or `bind()` made there, the context a timer or a resource
 * keeps under a symbol, copied onto a timer of its own) that flow's store, so the store alone does not say whose the code
 * is. The frames do.
 *
 * The frames are read from the access outward, up to where slothlet entered a call or the job began. The flow's own
 * code is the host's code or the code of a call of the flow (`owners`), with the helpers, packages and Node code they
 * run, which act for them. The code running is the flow's when the first code of anyone's found is the flow's, or when
 * code of the flow's is further out (it called the code running, as a call of the flow or the host calling a module's
 * function does). It is not when the first code found is a module's (or code no file accounts for) and nothing further
 * out is the flow's. Where an async resource put the flow in place (`runInAsyncScope`, which `bind()` and `snapshot()`
 * run through), the code that called it put it there: the flow's own code doing so keeps it, anyone else's does not, and
 * Node's own code beginning the job with it (a timer running a bound function) says nothing, so the code is held to the
 * frames inside alone.
 *
 * @param {string} instanceID - The instance the flow belongs to.
 * @param {ReadonlyArray<object>} owners - The calls of the flow: the call it names and the calls above it. Empty for a
 *   flow the host opened.
 * @returns {{outside: false, clean: boolean, found: boolean}|{outside: true, reader: object|null, begun: boolean}|null} For
 *   the flow's code, whether every frame up to where the code's job began or slothlet entered a call is the flow's
 *   (`clean`), and whether a frame of the flow's own code was found (`found`; false when nothing but slothlet's and
 *   Node's code is on the stack, as when Node runs a job it was handed); otherwise the leaf the code is (null when no
 *   single leaf of the instance stands for it), and whether the flow was put in place by an async resource's scope that
 *   Node itself entered as it began the job (`begun`: a bound function Node was handed), which the frames cannot tell
 *   apart. Null when the instance is not running.
 * @param {boolean} [making=false] - Whether the code is told as it makes an async resource (from an async hook's
 *   `init`): Node's own frames that make the resource (a timer's, an immediate's, a microtask's) sit above the code
 *   that asked for it, and are not where a job began.
 * @internal
 */
function runningOutsideFlow(instanceID, owners, making = false) {
	const reference = MapMethods.get(LIVE_INSTANCES, instanceID);
	const slothlet = reference ? WeakRefMethods.deref(reference) : null;
	if (!slothlet) return null;
	// The files of the flow's calls, read once a frame asks.
	let ownerFiles = null;
	const runtime_ownsPath = (path) => {
		if (ownerFiles === null) {
			ownerFiles = [];
			for (let i = 0; i < owners.length; i++) {
				const description = describeCall(owners[i]);
				if (description.comparablePath) listPush(ownerFiles, description.comparablePath);
				if (description.realComparablePath) listPush(ownerFiles, description.realComparablePath);
			}
		}
		return path !== null && ArrayMethods.includes(ownerFiles, path);
	};
	const ownsFile = (leaf) => {
		const description = describeCall(leaf);
		return runtime_ownsPath(description.comparablePath) || runtime_ownsPath(description.realComparablePath);
	};
	// What a frame is to the flow: "own" (the host's code or a call of the flow's), "foreign" (another module's code, or
	// code no file accounts for), or null (a package's or a helper's, which act for their caller).
	const kindOf = (frame) => {
		if (frame.evaluated || isForeignScript(frame)) return "foreign";
		// The copy of a call's own file the instance's loader imported: the call's code, as the frame placement below says.
		// A call's file carries the ID its node was built under, which a reload or restart since replaced for a call whose
		// flow outlives that copy (a snapshot it took): the copy the call ran is the call's code all the same.
		const tag = runtime_frameInstanceTag(frame.line);
		if (tag !== null && (tag === instanceID || runtime_builtUnderAny(owners, tag)) && runtime_ownsPath(frame.path)) return "own";
		const leaves =
			runtime_leafFileCopyOf(frame) !== null
				? null
				: runtime_leavesAtLocation(frame.path, frame.line, instanceID, frame.location ?? null, frame);
		if (leaves?.length) {
			for (let i = 0; i < leaves.length; i++) if (ArrayMethods.includes(owners, leaves[i]) || ownsFile(leaves[i])) return "own";
			return "foreign";
		}
		if (runtime_isInstanceFile(frame.path) || runtime_helperOwner(frame, null)) return null;
		// A package's file, or one a module of the instance loaded: it acts for whoever called it.
		if (
			(StringMethods.includes(frame.path, "/node_modules/") && !isInstanceOwnerFile(slothlet, frame.path)) ||
			SetMethods.size(runtime_packageImportingLeaves(slothlet, frame.path))
		)
			return null;
		return "own";
	};
	// `own`: whether the code is the flow's (undefined when the frames read stop before saying). `clean`: whether every
	// frame read, up to where slothlet entered a call or the job began, is the flow's or acts for it.
	const decide = (frames) => {
		let own;
		let foreign = false;
		// Past a `runInAsyncScope`: the code that called it put the flow in place, and is looked for.
		let switched = false;
		// Whether the frames read reach where slothlet entered a call or the job began.
		let ended = false;
		let cut = false;
		// Making a resource: below the hook's own frames, Node's frames up to the first frame of anyone else's code
		// (slothlet's included) are the resource's making.
		let leading = making;
		let pastHook = false;
		for (const frame of framesOf(frames)) {
			if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
				if (pastHook) leading = false;
				if (frame.enter) {
					ended = true;
					break;
				}
				continue;
			}
			if (!StringMethods.startsWith(frame.path, "node:")) leading = false;
			pastHook = true;
			if (frame.async || (!leading && isRunnerFrame(frame))) {
				ended = true;
				break;
			}
			let kind = null;
			if (StringMethods.startsWith(frame.path, "node:")) {
				// Code compiled under a `node:` name is no one's.
				if (!runtime_isNodeScript(frame)) kind = "foreign";
				else if (frame.path === "node:async_hooks" && StringMethods.endsWith(frame.head ?? "", "runInAsyncScope")) {
					switched = true;
					if (own !== undefined) {
						cut = true;
						break;
					}
				}
			} else kind = kindOf(frame);
			if (kind === "own") own ??= true;
			else if (kind === "foreign") {
				// Anyone else's code put the flow in place, or runs in it with nothing of the flow's calling it.
				if (own === undefined && switched) {
					own = false;
					cut = true;
					break;
				}
				foreign = true;
				if (own !== undefined) {
					cut = true;
					break;
				}
			}
		}
		if (!ended && !cut && !frames.truncated) ended = true;
		if (!ended && own === undefined && frames.truncated) return { own: undefined, clean: false, found: false };
		const found = own === true;
		// A scope nothing of anyone's put in place: Node began the job with it (a bound function it was handed).
		const begun = switched && own === undefined && !cut && ended;
		own ??= !foreign && !switched;
		return { own, clean: own && ended && !foreign && !switched, found, begun };
	};
	// The deciding frame is nearly always a few frames below slothlet's own: a short capture settles it, and the stack is
	// read further only when it does not. Cut off even then, the code is not taken for the flow's.
	let answer = decide(runtime_captureFrames(NEAR_FRAMES));
	if (answer.own === undefined) answer = decide(runtime_captureFrames(FAR_FRAMES));
	if (answer.own === true) return { outside: false, clean: answer.clean, found: answer.found };
	// The leaf the code running is, read as code run while no call runs is read.
	const definer = runtime_definerAt(runtime_captureFrames(24), instanceID);
	return { outside: true, reader: definer?.wrapper?.slothlet === slothlet ? definer.wrapper : null, begun: answer.begun === true };
}

/**
 * Node's own `AsyncResource.prototype.runInAsyncScope`, taken as slothlet loads, before any module's code runs: the
 * function whose frame {@link scopeEnteredByCode} looks for. A wrapper put on the prototype later (the live runtime's,
 * or a module's) still calls it to enter the scope. Null where the platform has no `node:async_hooks`.
 * @type {Function|null}
 * @private
 */
const RUN_IN_ASYNC_SCOPE = typeof AsyncResource?.prototype?.runInAsyncScope === "function" ? AsyncResource.prototype.runInAsyncScope : null;

/**
 * Whether the async resource running now was put in place by code, through `AsyncResource.prototype.runInAsyncScope()`
 * (which a resource's `bind()` runs through), rather than by Node as it began the resource's job. A promise or a
 * `process.nextTick()` job carries the async id `runInAsyncScope()` reads, so code holding one can run a function of its
 * own in that job's scope; Node itself never begins a promise's or a tick's job through `runInAsyncScope()`.
 *
 * Told without reading the frames: the capture skips every frame down to the innermost call of `runInAsyncScope()`
 * (`Error.captureStackTrace`'s second argument), and collects none when no such call is on the stack, so the engine
 * only walks the stack and formats at most one frame. A call with nothing of anyone's below it (a function bound to the
 * job that the engine calls by itself) collects none either; the caller tells that apart by another callback running
 * below the job (see `begunByNode` in `handlers/context-async`). A stack that cannot be read counts as entered by code.
 *
 * Used where Node runs every async hook for a promise's job (Node 22.15 and 24.0, whose hooks cannot leave promises
 * out), and before the install-time probe has answered.
 * @returns {boolean} True when a call of `runInAsyncScope()` is on the stack, or the stack cannot say.
 * @internal
 */
function scopeEnteredByCode() {
	// Only the async runtime asks, which runs only where `node:async_hooks` (and so `runInAsyncScope`) exists.
	/* v8 ignore if */
	if (RUN_IN_ASYNC_SCOPE === null) return true;
	const read = readStack(runtime_siteCount, { limit: 1, skip: RUN_IN_ASYNC_SCOPE });
	// A read that cannot be trusted (the stack settings fixed in place where no realm of slothlet's own can be made) can
	// happen, and counts as entered by code; the suite cannot make a realm fail to be made.
	/* v8 ignore if */
	if (read === null) return true;
	return read.value !== 0;
}

/**
 * V8's `prepareStackTrace` hook for {@link scopeEnteredByCode}: how many call sites were collected.
 * @param {Error} _error - The error being captured.
 * @param {Array<object>} callSites - V8 call sites.
 * @returns {number} Their count.
 * @private
 */
function runtime_siteCount(_error, callSites) {
	return callSites.length;
}

/**
 * The definer of the code doing an access while no call runs, read from frames already captured (see
 * {@link frameDefiner}).
 * @param {Iterable<object> & {truncated: boolean}} frames - The frames.
 * @param {string|null} running - The instance whose flow is running, when something names one.
 * @returns {{wrapper: object, callers: Array<object>}|{leaves: Array<object>, callers: Array<object>}|{unplaced: true, shared?: true}|null} The definer.
 * @private
 */
function runtime_definerAt(frames, running) {
	let index = -1;
	// The helper file of an instance the innermost code runs in, while the walk looks for the leaf that called it.
	let helper = null;
	for (const frame of framesOf(frames)) {
		index++;
		if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) continue;
		// A helper's code with no leaf's code calling it (the helper's function handed out as it is): the modules of the
		// files that import it stand for it, all of them.
		if (frame.async || isRunnerFrame(frame)) return helper ? (runtime_leafOfHelper(helper) ?? null) : null;
		// With no permission system on, nothing is refused: such code runs as plain JavaScript (#726).
		if (frame.evaluated) return runtime_anyInstanceChecks() ? { unplaced: true } : null;
		// Code at an instance's file running in a script slothlet does not recognise as the file's (code compiled under
		// its name, or a copy whose record is gone): it names a module's file, so it is no host's code either (#597).
		if (isForeignScript(frame)) return runtime_anyInstanceChecks() ? { unplaced: true, foreign: true } : null;
		// An untagged frame at an ES module file an instance loaded under its tag runs in another module of the file (a raw
		// `import` of it by a module, the host or a package), which slothlet loaded for no leaf: code no one accounts for,
		// as frame placement reads it inside a call (#691).
		if (runtime_isUntaggedCopy(frame)) return { unplaced: true };
		// A leaf's file an api file loaded itself runs as a helper file of that api file's, below.
		const copy = runtime_leafFileCopyOf(frame) !== null;
		const leaves = copy ? null : runtime_leavesAtLocation(frame.path, frame.line, running, frame.location ?? null, frame);
		if (leaves === null) {
			if (!copy && runtime_isInstanceFile(frame.path)) return { unplaced: true, shared: true };
			// A helper file of an instance that is no api file (one a leaf imports): its code runs for the leaf whose code
			// called it, so the walk goes on outward to the first frame of a leaf's file.
			const owner = runtime_helperOwner(frame, helper?.slothlet ?? null);
			if (owner) {
				helper ??= owner;
				continue;
			}
			// A leaf's file an api file imported itself, in a browser, where nothing records which api file that was: it is
			// no one's code, and is refused rather than taken for the page's.
			if (copy && !isNode && !helper) return runtime_anyInstanceChecks() ? { unplaced: true } : null;
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
		const callers = runtime_anyInstanceChecks()
			? filterList(runtime_outerCallers(frames, index), (caller) => !ArrayMethods.includes(narrowed, caller))
			: [];
		return narrowed.length === 1 ? { wrapper: narrowed[0], callers } : { leaves: narrowed, callers };
	}
	return helper ? (runtime_leafOfHelper(helper) ?? null) : null;
}

/**
 * Whether the instance's loader imported a leaf's file under the query a frame's location carries (see
 * {@link runtime_leavesAtLocation}). A loader that keeps no such record (a stand-in) says yes.
 * @param {object} wrapper - The leaf.
 * @param {string} location - The frame's location.
 * @returns {boolean} True when it did.
 * @private
 */
function runtime_importedUnder(wrapper, location) {
	// The loader of the node's own tree: a run that rebuilt its copy imported the files under queries of its own.
	const slothlet = wrapper.slothlet;
	const loader = typeof slothlet?._nodeLoader === "function" ? slothlet._nodeLoader(wrapper) : slothlet?.processors?.loader;
	if (typeof loader?.importedUnderQuery !== "function") return true;
	const at = StringMethods.indexOf(location, "?");
	if (at === -1) return false;
	const query = regExpReplace(/#.*$/, StringMethods.slice(location, at + 1), "");
	if (loader.importedUnderQuery(wrapper.____slothletInternal.filePath, query)) return true;
	// A lazy folder's node keeps the folder as its path while its function's code runs from the file it was written in.
	const sourceFile = WeakMapMethods.get(LEAF_SOURCE_FILES, wrapper);
	return sourceFile !== undefined && loader.importedUnderQuery(sourceFile, query);
}

/**
 * The load of an instance's file whose own code is running now, before any node stands for it: the file of the nearest
 * frame that is not slothlet's own or Node's, or the file an import is being resolved for, among the files the
 * instance's loader is loading (see `Loader#loadingFile`). Its top-level code runs as its module path (S4).
 * @param {object} slothlet - The instance.
 * @param {string|null} [importer=null] - The importing file's URL, for an import being resolved as the file links.
 * @returns {{path: string, moduleID: string|null, paths: ReadonlyArray<string>|null}|null} The load, or null.
 * @internal
 */
function runtime_loadingFileRunning(slothlet, importer = null) {
	const loader = slothlet?.processors?.loader;
	if (typeof loader?.loadingFile !== "function") return null;
	if (importer !== null) return loader.loadingFile(toComparablePath(importer), runtime_frameModuleTag(importer));
	for (const frame of framesOf(runtime_captureFrames(24))) {
		if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/") || StringMethods.startsWith(frame.path, "node:")) continue;
		if (frame.evaluated || isForeignScript(frame)) return null;
		const mount = runtime_frameModuleTag(frame.line);
		return (
			loader.loadingFile(frame.path, mount) ?? (runtime_frameInstanceTag(frame.line) ? runtime_loadingHelper(slothlet, frame.path) : null)
		);
	}
	return null;
}

/**
 * A helper file of an instance's being evaluated for the first time, during the load of a file that imports it: the
 * paths of every api file importing it, directly or through other helpers, as the import record has them (#742). An
 * importing file still loading answers its load's paths (see `Loader#loadingFile`), one already built its module path.
 * Null when any importer cannot be named, or the helper has none.
 * @param {object} slothlet - The instance.
 * @param {string} helperPath - The helper's file, in comparable form.
 * @returns {{path: string, moduleID: null, paths: ReadonlyArray<string>}|null} The paths it runs as, or null.
 * @private
 */
function runtime_loadingHelper(slothlet, helperPath) {
	const graph = runtime_importGraph(slothlet.instanceID);
	const loader = slothlet.processors.loader;
	const paths = new Set();
	const seen = setFrom([helperPath]);
	const queue = [helperPath];
	let anyLoading = false;
	while (queue.length) {
		const importers = MapMethods.get(graph, ArrayMethods.pop(queue));
		if (!(importers == null ? undefined : SetMethods.size(importers))) return null;
		for (const importer of setValues(importers)) {
			if (SetMethods.has(seen, importer)) continue;
			SetMethods.add(seen, importer);
			const load = loader.loadingFile(importer);
			if (load) {
				if (!load.paths?.length) return null;
				anyLoading = true;
				for (let index = 0; index < load.paths.length; index++) SetMethods.add(paths, load.paths[index]);
				continue;
			}
			const leaves = runtime_leavesAtFile(slothlet, importer, null, null);
			if (leaves.length) {
				const module = runtime_fileModuleOf(leaves);
				if (module.length !== 1) return null;
				SetMethods.add(paths, String(module[0].____slothletInternal.apiPath ?? ""));
				continue;
			}
			// Another helper: the files importing it stand for it in turn.
			if (SetMethods.size(seen) > PACKAGE_WALK) return null;
			listPush(queue, importer);
		}
	}
	// A helper evaluating for the first time is evaluated inside a load of a file importing it.
	return anyLoading && SetMethods.size(paths) ? { path: helperPath, moduleID: null, paths: Objects.freeze(setToArray(paths)) } : null;
}

/**
 * Whether a frame carrying no instance tag runs at an ES module file a running instance with its permission system on
 * built leaves from (see {@link runtime_definerAt}). In Node, and under a vite runner, slothlet loads each such file
 * under the instance's tag; a CommonJS file runs under its plain path, and is told by its script instead.
 * @param {{path: string, line: string}} frame - A frame.
 * @returns {boolean} True for another module of the file.
 * @private
 */
function runtime_isUntaggedCopy(frame) {
	if (!isNode || runtime_frameInstanceTag(frame.line)) return false;
	for (let ofIndex = 0, ofList = mapValues(LIVE_INSTANCES); ofIndex < ofList.length; ofIndex++) {
		const reference = ofList[ofIndex];
		const slothlet = WeakRefMethods.deref(reference);
		if (!slothlet || !runtime_checksPermissions(slothlet) || !runtime_instanceRuns(slothlet)) continue;
		if (SetMethods.has(runtime_commonJSLocations(slothlet.instanceID), frame.path)) continue;
		if (ArrayMethods.some(runtime_leavesAtFile(slothlet, frame.path, null, null), (wrapper) => wrapper.____slothletInternal.moduleID))
			return true;
	}
	return false;
}

/**
 * Hold code that picked up after an `await` with no call of its own to the rules of every module of its instance, in a
 * runtime that cannot tell which call started it (the live runtime). A module's call can start an async function and
 * return without awaiting it: the async runtime's store carries that call into the function's flow, so its rules hold
 * the code however long it runs. The live runtime reads who is calling from the calls in flight, and once the call
 * that started the flow has returned no frame says which module that was. Unless the flow is the host's own (the host's
 * code is what awaits it), any module could have started it, so every one of them has to allow what the code does,
 * along with its definer: with nothing denied the code runs as before, and it is refused where one of them would be.
 * Code the host or a package calls synchronously, and a callback Node runs (a timer's, an event's), have their caller's
 * frames below and are left as they are.
 * @param {object|null} definer - The definer {@link runtime_definerAt} read.
 * @param {Iterable<object> & {truncated: boolean}} frames - The frames it read.
 * @returns {object|null} The definer, with every module of its instance among its callers when it is held to them.
 * @private
 */
function runtime_holdDetachedJob(definer, frames) {
	if (!definer?.callers) return definer;
	const slothlet = (definer.wrapper ?? definer.leaves[0]).slothlet;
	// Only a runtime that says it cannot carry a call into a flow it started (the live runtime) needs it.
	if (slothlet?.contextManager?.carriesFlowCaller !== false || !runtime_checksPermissions(slothlet)) return definer;
	// The module call that started the flow, where the runtime could record it (Node's promise hooks): it holds the
	// flow whoever awaits it, as the async runtime's store does.
	const starter = slothlet.contextManager.runningFlowStarter?.() ?? null;
	const started =
		starter && WeakSetMethods.has(trustedRootOwn.genuineWrappers, starter.wrapper) && starter.wrapper.slothlet === slothlet
			? concatLists([starter.wrapper], ceilingMembers(starter.ceiling ?? null))
			: [];
	const letGo = runtime_jobLetGo(frames, slothlet);
	if (!letGo && !started.length) return definer;
	return {
		...definer,
		callers: setToArray(setFrom(concatLists(definer.callers, started, letGo ? runtime_instanceLeaves(slothlet) : [])))
	};
}

/**
 * Whether the job running is code of an instance's own that picked up after an `await` (or as a promise reaction) in a
 * flow that may be a module's: the outermost frame of its synchronous part is a module's or a helper file's, with
 * nothing below it but the engine's microtask runner (not slothlet's own code, which began a job it runs), and the
 * innermost flow awaiting it, if any, is no code of the host's own. A frame of the host's or a package's below it, or Node's own code that ran it (a timer, an emitter), says
 * it was called; the host's code awaiting it says the flow is the host's. Read further out when the frames read were
 * cut off first, and taken to be a module's flow when even that is cut off.
 * @param {Iterable<object> & {truncated: boolean}} frames - The frames.
 * @param {object} slothlet - The instance the code belongs to.
 * @returns {boolean} True when it may be a module's flow.
 * @private
 */
function runtime_jobLetGo(frames, slothlet) {
	// Whether a frame is code of the instance's own, or code no one can be named for.
	const instanceCode = (frame) =>
		frame.evaluated ||
		isForeignScript(frame) ||
		runtime_isInstanceFile(frame.path) ||
		runtime_leavesAtLocation(frame.path, frame.line) !== null ||
		runtime_helperOwner(frame) !== null;
	const read = (list) => {
		// Whether the outermost frame of the synchronous part read so far is the instance's own code.
		let outermostOwn = false;
		let syncEnded = false;
		for (const frame of framesOf(list)) {
			if (!syncEnded) {
				// Slothlet's own code running the instance's (a trap it reads while it builds or settles something) began
				// the job: it is no flow a module let go of.
				if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
					if (!frame.async) {
						outermostOwn = false;
						continue;
					}
				}
				if (frame.async || isRunnerFrame(frame)) {
					// A timer's callback is called by Node's timers; a resumed function and a reaction by the microtask runner.
					if (!outermostOwn || frame.path === "node:internal/timers") return false;
					syncEnded = true;
				} else {
					outermostOwn = !StringMethods.startsWith(frame.path, "node:") && instanceCode(frame);
					continue;
				}
			}
			// The flows awaiting it: the innermost one that is someone's code says whose flow this is.
			if (
				!frame.async ||
				!frame.path ||
				StringMethods.startsWith(frame.path, "node:") ||
				StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")
			)
				continue;
			if (instanceCode(frame)) return true;
			// A package a module loaded awaits it for that module; any other file's code is the host's.
			return SetMethods.size(runtime_packageImportingLeaves(slothlet, frame.path)) > 0;
		}
		return list.truncated ? undefined : syncEnded || outermostOwn;
	};
	return read(frames) ?? read(runtime_captureFrames(FAR_FRAMES)) ?? true;
}

/**
 * Every leaf of an instance its frames could name: the leaves built from its files and still in its tree.
 * @param {object} slothlet - The instance.
 * @returns {Array<object>} The leaves.
 * @private
 */
function runtime_instanceLeaves(slothlet) {
	const leaves = new Set();
	for (let ofIndex = 0, ofList = mapValues(WeakMapMethods.get(LEAF_FILES, slothlet)); ofIndex < ofList.length; ofIndex++) {
		const held = ofList[ofIndex];
		for (const reference of setValues(held)) {
			const wrapper = WeakRefMethods.deref(reference);
			if (wrapper && !runtime_isGone(wrapper)) SetMethods.add(leaves, wrapper);
		}
	}
	return setToArray(leaves);
}

/**
 * The api file a helper copy's frame was loaded for (see {@link runtime_frameImporterTag}), when the instance's own
 * record of imports bears it out: the copy's URL is text any code can write (an `import()` naming another api file),
 * so the name stands only when that api file imports the helper's file, directly or through other helpers, as the
 * resolve hook recorded it. Null for a frame that names none, or one the record does not bear out; the frame is then
 * read as a helper loaded once per instance is.
 * @param {string} family - The instance ID the frame carries.
 * @param {{path: string, line: string}} frame - The frame.
 * @returns {{path: string, mount: string|null}|null} The api file in comparable form and its mount, or null.
 * @private
 */
function runtime_helperCopyOf(family, frame) {
	const loadedFor = runtime_frameImporterTag(frame.line);
	if (!loadedFor || loadedFor.path === frame.path) return null;
	const graph = runtime_importGraph(family);
	const seen = setFrom([frame.path]);
	const queue = [frame.path];
	while (queue.length && SetMethods.size(seen) <= PACKAGE_WALK) {
		for (const importer of setValues(MapMethods.get(graph, ArrayMethods.pop(queue)))) {
			if (importer === loadedFor.path) return loadedFor;
			if (SetMethods.has(seen, importer)) continue;
			SetMethods.add(seen, importer);
			listPush(queue, importer);
		}
	}
	return null;
}

/**
 * The running instance whose helper file a frame runs in: a file loaded under the instance's import tag, or one of its
 * CommonJS files, that no leaf was built from. Null for a CommonJS file more than one running instance loads.
 * @param {{path: string, line: string, evaluated?: boolean}} frame - The frame.
 * @param {object|null} [only=null] - Answer for this instance alone.
 * @returns {{slothlet: object, path: string, importer: {path: string, mount: string|null}|null}|null} The instance
 *   and the helper's file, with the api file the copy was loaded for when its frame names one, or null.
 * @private
 */
function runtime_helperOwner(frame, only = null) {
	if (frame.evaluated || StringMethods.startsWith(frame.path, "node:")) return null;
	const tag = runtime_frameInstanceTag(frame.line);
	let found = null;
	for (const ofEntry of mapEntries(LIVE_INSTANCES)) {
		const id = ofEntry[0],
			reference = ofEntry[1];
		const slothlet = WeakRefMethods.deref(reference);
		if (!slothlet || (only && slothlet !== only) || !runtime_instanceRuns(slothlet)) continue;
		if (tag ? id !== tag : !SetMethods.has(runtime_commonJSLocations(id), frame.path)) continue;
		// A leaf's file is a helper only where an api file of the instance loaded it itself.
		if (runtime_leavesAtFile(slothlet, frame.path, null, null).length && runtime_leafFileCopyOf(frame) !== slothlet) continue;
		// A CommonJS helper two running instances load carries no tag to tell them apart (#735): it is no one's here.
		if (found) return null;
		// A copy loaded for one api file (`helpers: "module"`) names it.
		found = { slothlet, path: frame.path, importer: tag ? runtime_helperCopyOf(id, frame) : null };
	}
	return found;
}

/**
 * The files of an instance that import a helper file, directly or through other helpers, as the instance's resolve
 * hook recorded them. For a copy of the helper loaded for one api file (`helpers: "module"`), that api file.
 * @param {{slothlet: object, path: string, importer?: {path: string, mount: string|null}|null}} helper - The helper.
 * @returns {Set<string>} The importing files, in comparable form, the helper's own included.
 * @private
 */
function runtime_helperImporters(helper) {
	// A copy loaded for one api file is that file's alone, whoever else imports the helper's file.
	if (helper.importer) return setFrom([helper.path, helper.importer.path]);
	const graph = runtime_importGraph(helper.slothlet.instanceID);
	const seen = setFrom([helper.path]);
	const queue = [helper.path];
	while (queue.length && SetMethods.size(seen) <= PACKAGE_WALK) {
		for (const importer of setValues(MapMethods.get(graph, ArrayMethods.pop(queue)))) {
			if (SetMethods.has(seen, importer)) continue;
			SetMethods.add(seen, importer);
			listPush(queue, importer);
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
	if (SetMethods.size(importers) === 1) return true;
	const mount = helper.importer?.mount ?? null;
	return ArrayMethods.some(leaves, (leaf) => {
		const filePath = leaf.____slothletInternal.filePath;
		if (!filePath || (mount && leaf.____slothletInternal.moduleID !== mount)) return false;
		if (SetMethods.has(importers, toComparablePath(filePath)) || SetMethods.has(importers, runtime_realComparablePath(filePath)))
			return true;
		// A leaf run from another location (a TypeScript leaf's compiled copy) is named by it.
		for (const location of setValues(runtime_importedLocations(leaf, filePath))) if (SetMethods.has(importers, location)) return true;
		return false;
	});
}

/**
 * Whether a function a leaf hands out is written in a leaf's own file and in no helper file of its instance (#726), as
 * far as the sources the loader recorded say. Such a function is told by its frames when it runs, so one stand-in of it
 * serves every leaf of its module; any other (a helper file's own function, a bound or native function, one whose
 * source cannot be found) is handed out per leaf, each stand-in recording the leaf that handed it out. A class is one
 * value whoever hands it out. Decided from the function's text and the recorded sources alone: nothing of the function
 * runs.
 * @param {Function} fn - The function.
 * @param {Array<object>} leaves - The wrappers of the leaves that handed it out.
 * @returns {boolean} True when one stand-in serves every leaf.
 * @internal
 * @example
 * isLeafFileFunction(fn, [first, owner]); // false for a function written in a helper file
 */
function isLeafFileFunction(fn, leaves) {
	let own;
	try {
		own = functionSource(fn);
	} catch {
		return false;
	}
	if (RegExpMethods.exec(/^class(?![\w$])/, own) !== null) return true;
	if (RegExpMethods.exec(/\{\s*\[native code\]\s*\}\s*$/, own) !== null) return false;
	let inLeaf = false;
	for (let ofIndex = 0, ofList = leaves; ofIndex < ofList.length; ofIndex++) {
		const leaf = ofList[ofIndex];
		const internal = leaf?.____slothletInternal;
		const filePath = internal?.filePath;
		const slothlet = leaf?.slothlet;
		if (typeof filePath !== "string" || !slothlet) continue;
		const texts = [];
		const locations = setFrom([toComparablePath(filePath), runtime_realComparablePath(filePath)]);
		for (const imported of setValues(runtime_importedLocations(leaf, filePath))) SetMethods.add(locations, imported);
		for (const location of setValues(locations)) {
			if (!location) continue;
			for (
				let ofIndex = 0,
					ofList = [`${location}\u0000${slothlet.instanceID ?? ""}\u0000${internal.moduleID ?? ""}`, `${location}\u0000\u0000`];
				ofIndex < ofList.length;
				ofIndex++
			) {
				const key = ofList[ofIndex];
				const text = loadedScriptText(key, null);
				if (typeof text === "string") listPush(texts, text);
			}
		}
		// Nothing recorded for the file (a loader slothlet's hook does not see): the file as it can be read.
		if (!texts.length && isNode && !StringMethods.startsWith(filePath, "synthetic:")) {
			const source = runtime_sourceOf(filePath);
			if (source) listPush(texts, source.text);
		}
		if (ArrayMethods.some(texts, (text) => StringMethods.includes(text, own))) {
			inLeaf = true;
			break;
		}
	}
	if (!inLeaf) return false;
	// The same text in a helper file of the instance: the function may be the helper's.
	for (let ofIndex = 0, ofList = leaves; ofIndex < ofList.length; ofIndex++) {
		const leaf = ofList[ofIndex];
		const slothlet = leaf.slothlet;
		const family = slothlet?.instanceID;
		if (!family) continue;
		for (const file of setValues(runtime_importGraphEntry(family).files)) {
			if (RegExpMethods.exec(/\.(?:json|node|wasm)$/i, file) !== null || runtime_leavesAtFile(slothlet, file, null, null).length) continue;
			// As recorded when the helper loaded; where the hook recorded nothing, the file as it can be read. A helper
			// whose source cannot be found may hold the function.
			const text =
				loadedScriptText(`${file}\u0000${family}\u0000`, null) ??
				loadedScriptText(`${file}\u0000\u0000`, null) ??
				(isNode ? runtime_sourceOf(file)?.text : undefined);
			if (typeof text !== "string" || StringMethods.includes(text, own)) return false;
		}
	}
	return true;
}

/**
 * The modules of the api files that import a helper file, directly or through other helpers: for each such file, the
 * file's own node (see {@link runtime_fileModuleOf}), or every leaf built from it where no node was built for the file.
 * @param {{slothlet: object, path: string}} helper - The helper.
 * @returns {Array<object>} The modules' wrappers, none when no api file is recorded as importing it.
 * @private
 */
function runtime_helperModules(helper) {
	const modules = new Set();
	for (const file of setValues(runtime_helperImporters(helper))) {
		// The helper's own file stands for nothing: a leaf's file an api file loaded itself is held to that api file alone.
		if (file === helper.path) continue;
		const leaves = runtime_leavesAtFile(helper.slothlet, file, null, helper.importer?.mount ?? null);
		if (!leaves.length) continue;
		for (let ofIndex = 0, ofList = runtime_fileModuleOf(leaves); ofIndex < ofList.length; ofIndex++) {
			const module = ofList[ofIndex];
			SetMethods.add(modules, module);
		}
	}
	return setToArray(modules);
}

/**
 * The definer of a helper file's code that no leaf's code called (#726): a helper file has no leaf of its own, so only
 * the files importing it can stand for it. With one api file importing the helper, that file's module. With several,
 * nothing on the stack says which of them the code runs for, so it is held to every one of them: the first is the
 * definer and the others come as its `callers`, which have to be allowed as well. Undefined when no api file is
 * recorded as importing it. With the permission system off nothing is checked, and the first gives the code its context.
 * @param {{slothlet: object, path: string}} helper - The helper.
 * @returns {{wrapper: object, callers: Array<object>}|undefined} The definer.
 * @private
 */
function runtime_leafOfHelper(helper) {
	const unpacked1 = runtime_helperModules(helper),
		first = unpacked1[0],
		others = copyList(unpacked1, 1);
	if (!first) return undefined;
	return { wrapper: first, callers: runtime_checksPermissions(helper.slothlet) ? others : [] };
}

/**
 * The answer for a helper file's own code running inside a call whose leaf does not import the helper (#726): a
 * function of the helper's that reached the call by some route (handed out by a leaf that imports it, then handed in).
 * It is the code of the modules whose api files import the helper, all of them, under the call it runs inside, what
 * that call runs under and the calls that handed code down. Null when the frame is no helper file of the call's
 * instance, or no api file is recorded as importing it.
 * @param {{wrapper: object, ceiling?: object|ReadonlyArray<object>|null}} record - The call the code runs inside.
 * @param {{path: string, line: string}} frame - The code's frame.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|null} The answer.
 * @private
 */
function runtime_helperAnswer(record, frame) {
	const helper = runtime_helperOwner(frame, record.wrapper.slothlet);
	if (!helper) return null;
	const unpacked2 = runtime_helperModules(helper),
		first = unpacked2[0],
		others = copyList(unpacked2, 1);
	if (!first) return null;
	return {
		wrapper: first,
		ceiling: Reflect.apply(combineCeilings, undefined, concatLists([record.wrapper, record.ceiling, supplierChainCeiling(record)], others))
	};
}

/**
 * Whether a file is one some running instance whose permission system is on built a leaf from.
 * @param {string} path - Comparable path.
 * @returns {boolean} True when one did.
 * @private
 */
function runtime_isInstanceFile(path) {
	for (let ofIndex = 0, ofList = mapValues(LIVE_INSTANCES); ofIndex < ofList.length; ofIndex++) {
		const reference = ofList[ofIndex];
		const slothlet = WeakRefMethods.deref(reference);
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
	for (let ofIndex = 0, ofList = mapValues(LIVE_INSTANCES); ofIndex < ofList.length; ofIndex++) {
		const reference = ofList[ofIndex];
		const slothlet = WeakRefMethods.deref(reference);
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
	return Boolean(slothlet?.handlers?.permissionManager?.isEnabled?.() && slothlet.config?.permissions?.caller?.provenance !== false);
}

/**
 * Each instance's leaves by the file they were built from, in comparable form (and real path, when a symlink makes
 * it differ), held weakly: who wrote code running from a file, found from a frame (#597).
 * @type {WeakMap<object, Map<string, Set<WeakRef<object>>>>}
 * @private
 */
const LEAF_FILES = new WeakMap();

/**
 * The file a wrapper is indexed at when it is not the wrapper's own `filePath` (see {@link registerLeafFile}): a lazy
 * folder's node, whose function's code runs from the folder's file.
 * @type {WeakMap<object, string>}
 * @private
 */
const LEAF_SOURCE_FILES = new WeakMap();

/**
 * Index a wrapper by the file it was built from (see {@link LEAF_FILES}).
 * @param {object} wrapper - A genuine wrapper.
 * @param {string} [at] - The file to index it at, when it is not the wrapper's own `filePath`: a lazy folder whose only
 *   file is its function is built with the folder as its path, while the function's code runs from the file.
 * @returns {void}
 * @internal
 */
function registerLeafFile(wrapper, at = undefined) {
	const filePath = at ?? wrapper?.____slothletInternal?.filePath;
	const slothlet = wrapper?.slothlet;
	if (!filePath || !slothlet || typeof WeakRef !== "function") return;
	if (
		slothlet.instanceID &&
		!(MapMethods.get(LIVE_INSTANCES, slothlet.instanceID) == null
			? undefined
			: WeakRefMethods.deref(MapMethods.get(LIVE_INSTANCES, slothlet.instanceID)))
	)
		MapMethods.set(LIVE_INSTANCES, slothlet.instanceID, new WeakRef(slothlet));
	let files = WeakMapMethods.get(LEAF_FILES, slothlet);
	if (!files) WeakMapMethods.set(LEAF_FILES, slothlet, (files = new Map()));
	if (at !== undefined) WeakMapMethods.set(LEAF_SOURCE_FILES, wrapper, at);
	const reference = new WeakRef(wrapper);
	// The file itself, and where its code actually runs from when that is another file: a TypeScript leaf runs from
	// the compiled copy slothlet wrote for it, so that copy's frames are the leaf's.
	const locations = setFrom([toComparablePath(filePath), runtime_realComparablePath(filePath)]);
	for (const imported of setValues(runtime_importedLocations(wrapper, filePath))) SetMethods.add(locations, imported);
	let paths = WeakMapMethods.get(LEAF_FILE_PATHS, slothlet);
	if (!paths) WeakMapMethods.set(LEAF_FILE_PATHS, slothlet, (paths = new Map()));
	const internal = wrapper.____slothletInternal;
	const record = { apiPath: String(internal.apiPath ?? ""), root: runtime_moduleRootPath([wrapper]), moduleID: internal.moduleID ?? null };
	for (const location of setValues(locations)) {
		if (!location) continue;
		let held = MapMethods.get(files, location);
		if (!held) MapMethods.set(files, location, (held = new Set()));
		SetMethods.add(held, reference);
		let known = MapMethods.get(paths, location);
		if (!known) MapMethods.set(paths, location, (known = new Map()));
		MapMethods.set(known, record.apiPath + "\0" + (record.moduleID ?? ""), record);
	}
}

/**
 * Each instance's api paths of the nodes built from each file, by the same locations {@link LEAF_FILES} indexes the nodes
 * at, kept as paths: the nodes go with the copy a reload or restart replaces, and in a lazy tree the copy the instance
 * has now builds the file's nodes only once something reaches them (see {@link runtime_replacedCopyLeaves}).
 * @type {WeakMap<object, Map<string, Map<string, {apiPath: string, root: string|null, moduleID: string|null}>>>}
 * @private
 */
const LEAF_FILE_PATHS = new WeakMap();

/**
 * The instance's nodes that stand now for code of a file's copy a reload or restart replaced (see
 * {@link runtime_taggedLeavesAtFile}): its nodes built from the same file, of the same mount, or, where a lazy tree has
 * not built them yet, the node at the api path one of them had, or at that file's module path.
 * @param {object} slothlet - The instance.
 * @param {string} path - The file, in comparable form.
 * @param {string|null} mount - The mount tag the code carries, or null.
 * @returns {Array<object>} The nodes.
 * @private
 */
function runtime_replacedCopyLeaves(slothlet, path, mount) {
	const current = slothlet.instanceID;
	const built = runtime_leavesAtFile(slothlet, path, current, mount);
	if (built.length) return built;
	const paths = WeakMapMethods.get(LEAF_FILE_PATHS, slothlet);
	const known = paths === undefined ? undefined : MapMethods.get(paths, path);
	if (!known) return [];
	const found = [];
	for (let ofIndex = 0, ofList = mapValues(known); ofIndex < ofList.length; ofIndex++) {
		const record = ofList[ofIndex];
		if ((record.moduleID ?? null) !== (mount ?? null)) continue;
		const candidates = [record.apiPath, record.root];
		for (let index = 0; index < candidates.length; index++) {
			const at = candidates[index];
			if (at === null) continue;
			const node = moduleNodeResolver(slothlet, at);
			if (
				!node ||
				!WeakSetMethods.has(trustedRootOwn.genuineWrappers, node) ||
				node.slothlet !== slothlet ||
				runtime_isGone(node) ||
				runtime_builtUnder(node) !== current
			)
				continue;
			if (!ArrayMethods.includes(found, node)) listPush(found, node);
			break;
		}
	}
	return found;
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
	// A leaf's file an api file loaded itself is a helper of that file's, and no leaf's.
	if (runtime_leafFileCopyOf(frame)) return [];
	const tag = runtime_frameInstanceTag(frame.line);
	const mount = runtime_frameModuleTag(frame.line);
	const location = typeof frame.location === "string" ? frame.location : null;
	return (
		runtime_runRestartReplacedLeaves(slothlet, frame.path, tag, mount, location, frame) ??
		runtime_leavesAtFile(slothlet, frame.path, tag, mount)
	);
}

/**
 * The nodes a `restart()` of the running code's `run()` / `scope()` replaced that stand for code of a file, when the
 * code is theirs: the code of the trees the run read before its restart carries none of the reload stamps the files of
 * the trees built for it since were loaded under (see `Slothlet#_runRestart`). An ES module carries its stamp in its
 * URL; a CommonJS file runs under its plain path, and its script tells the stamp instead: a run's own restart, and the
 * reloads in the run after it, seal the leaf's source for it (see `SEALED_BUILDS` in helpers/instance-imports), and a
 * script sealed for no restart, or for one whose seal is gone, carries none of the stamps. As for code an instance's
 * restart replaced (see {@link runtime_taggedLeavesAtFile}), those nodes stand for it, never the rebuilt copy's nodes of
 * the same file, and they have no standing. Null when the code is not such code, no such node is left, the permission
 * system is off, or the frame tells neither (an ES module's location with no instance tag, a script slothlet did not
 * load as a CommonJS leaf).
 * @param {object} slothlet - The instance.
 * @param {string} path - The file, in comparable form.
 * @param {string|null} tag - The instance tag the frame carries, or null.
 * @param {string|null} mount - The mount tag the frame carries, or null.
 * @param {string|null} location - The frame's location, query included, or null.
 * @param {{hash?: string|null, key?: string|null}|null} [frame=null] - The frame, for the script it runs.
 * @returns {Array<object>|null} The nodes, or null.
 * @private
 */
function runtime_runRestartReplacedLeaves(slothlet, path, tag, mount, location, frame = null) {
	if (location === null || !runtime_checksPermissions(slothlet)) return null;
	const restart = slothlet._runRestart?.() ?? null;
	if (restart === null) return null;
	let stamp;
	if (runtime_frameInstanceTag(location) !== null) stamp = runtime_frameReloadStamp(location);
	else {
		// A CommonJS leaf's own load, told by its script.
		if (!frame?.hash || !frame.key) return null;
		const script = loadedScriptLookup(frame.key, frame.hash);
		// A script of no load slothlet recorded for the file says nothing either way; a helper load is a helper file's.
		if (!script.known || script.helper) return null;
		// A script of the file slothlet no longer recognises is no copy the run built since its restart: it carries
		// none of the stamps, and is never taken for the rebuilt copy's code.
		stamp = script.has ? (script.stamp ?? null) : null;
	}
	if (SetMethods.has(restart.stamps, stamp ?? "")) return null;
	const replaced = runtime_leavesAtFile(slothlet, path, tag, mount, true);
	return replaced.length ? replaced : null;
}

/**
 * What {@link runtime_leafFileCopyOf} answers for a CommonJS file's helper load that more than one running instance
 * holds a leaf of.
 * @type {object}
 * @private
 */
const UNTOLD_COPY = Objects.freeze({});

/**
 * The running instance whose api file loaded a leaf's file itself, when a frame runs in what that load evaluated: a
 * module of the file other than the one slothlet loaded the leaf from, which is a helper the api file imports, as any
 * other file it imports is (#691). An ES module's is told by its tags (the instance's, with none of the mounts the
 * instance's loader imported the file under); a CommonJS file's, which runs under its plain path, by its script, one
 * the instance's scope loaded as no leaf. The leaf's own load is never one. Null for any other frame.
 * @param {{path: string, line: string, location?: string, hash?: string|null, key?: string|null, evaluated?: boolean}} frame - A frame.
 * @returns {object|null} The instance, {@link UNTOLD_COPY} when more than one running instance could be it, or null.
 * @private
 */
function runtime_leafFileCopyOf(frame) {
	if (frame.evaluated || typeof frame.line !== "string") return null;
	if (Objects.hasOwn(frame, "leafFileCopy")) return frame.leafFileCopy;
	const found = isNode ? runtime_nodeLeafFileCopyOf(frame) : runtime_browserLeafFileCopyOf(frame);
	Objects.defineProperty(frame, "leafFileCopy", { __proto__: null, value: found, enumerable: false });
	return found;
}

/**
 * {@link runtime_leafFileCopyOf} in a browser, where no import is recorded and scripts carry no hash: a frame carrying
 * no instance tag at a leaf's file that the instance's loader imported only under its tags (an `http:`, `https:` or
 * `file:` URL always gets them). A sibling's relative import of the file resolves to its plain URL, a module of its own.
 * A leaf imported from a URL that carries no tag (a `blob:` or `data:` URL, an import-map name) runs under that URL,
 * which an import of the file by another name does not share, and is not told apart here.
 * @param {{path: string, line: string}} frame - A frame.
 * @returns {object|null} The instance, {@link UNTOLD_COPY} when more than one running instance could be it, or null.
 * @private
 */
function runtime_browserLeafFileCopyOf(frame) {
	if (runtime_frameInstanceTag(frame.line)) return null;
	let found = null;
	for (let ofIndex = 0, ofList = mapValues(LIVE_INSTANCES); ofIndex < ofList.length; ofIndex++) {
		const slothlet = WeakRefMethods.deref(ofList[ofIndex]);
		if (!slothlet || !runtime_instanceRuns(slothlet)) continue;
		const leaves = runtime_leavesAtFile(slothlet, frame.path, null, null);
		if (!leaves.length) continue;
		const tagged = ArrayMethods.every(leaves, (wrapper) => {
			const filePath = wrapper.____slothletInternal?.filePath;
			const urls = wrapper.slothlet?.processors?.loader?.importedLocationsFor?.(filePath);
			return (
				urls != null &&
				SetMethods.size(urls) > 0 &&
				ArrayMethods.every(setToArray(urls), (url) => RegExpMethods.exec(/[?&]slothlet_instance=/, String(url)) !== null)
			);
		});
		if (!tagged) continue;
		if (found) return UNTOLD_COPY;
		found = slothlet;
	}
	return found;
}

/**
 * {@link runtime_leafFileCopyOf} under Node.
 * @param {{path: string, line: string, location?: string, hash?: string|null, key?: string|null}} frame - A frame.
 * @returns {object|null} The instance, {@link UNTOLD_COPY} when more than one running instance could be it, or null.
 * @private
 */
function runtime_nodeLeafFileCopyOf(frame) {
	let found = null;
	const tag = runtime_frameInstanceTag(frame.line);
	const helperScript = !tag && Boolean(frame.hash && frame.key && loadedScriptLookup(frame.key, frame.hash).helper);
	if (tag || helperScript) {
		for (const ofEntry of mapEntries(LIVE_INSTANCES)) {
			const id = ofEntry[0],
				reference = ofEntry[1];
			if (tag && id !== tag) continue;
			const slothlet = WeakRefMethods.deref(reference);
			if (!slothlet || !runtime_instanceRuns(slothlet)) continue;
			if (!runtime_leavesAtFile(slothlet, frame.path, null, null).length) continue;
			if (tag) {
				const location = typeof frame.location === "string" ? frame.location : null;
				if (runtime_taggedLeavesAtFile(slothlet, frame.path, tag, runtime_frameModuleTag(frame.line), location, true).length) continue;
			} else if (!SetMethods.has(runtime_commonJSLocations(id), frame.path)) continue;
			// A CommonJS file two running instances load carries nothing to tell them apart: still no leaf's, and no one
			// instance's helper either, as a CommonJS helper they both load is not (#735).
			if (found) {
				found = UNTOLD_COPY;
				break;
			}
			found = slothlet;
		}
	}
	return found;
}

/**
 * The leaves of an instance a frame's code at a file stands for, by the instance and mount tags the frame carries
 * (see {@link runtime_leavesAtFile}). A frame carrying a mount's tag runs in a copy slothlet's loader imported for it
 * only when the loader imported the file under that exact query: one some module wrote out for it (another parameter
 * added) is a module of its own making (#691). Code of the copy a reload or restart replaced carries the ID the
 * instance had then, and its nodes are gone with that copy: the instance's nodes built from the same file, of the same
 * mount, stand for it now, so a function that copy handed out keeps reading `self` as its definer. With the permission
 * system on that holds for a reload only: the modules a restart replaced are removed with the instance they were in,
 * and what they made has no standing (#726).
 * @param {object} slothlet - The instance.
 * @param {string} path - The file, in comparable form.
 * @param {string|null} tag - The instance tag the frame carries, or null.
 * @param {string|null} mount - The mount tag the frame carries, or null.
 * @param {string|null} location - The frame's location, query included, or null.
 * @param {boolean} runs - Whether the instance runs (see {@link runtime_instanceRuns}).
 * @param {{hash?: string|null, key?: string|null}|null} [frame=null] - The frame, for the script it runs (see
 *   {@link runtime_runRestartReplacedLeaves}).
 * @returns {Array<object>} The leaves.
 * @private
 */
function runtime_taggedLeavesAtFile(slothlet, path, tag, mount, location, runs, frame = null) {
	const replaced = runtime_runRestartReplacedLeaves(slothlet, path, tag, mount, location, frame);
	if (replaced !== null) return replaced;
	let leaves = runtime_leavesAtFile(slothlet, path, tag, mount);
	if (mount && location !== null) leaves = filterList(leaves, (wrapper) => runtime_importedUnder(wrapper, location));
	const current = slothlet.instanceID;
	if (leaves.length || !tag || !runs || current === tag) return leaves;
	// The nodes a restart replaced stand for it: they have no standing, so what the code does through `self` is refused
	// as their code (see ApiManager#isRestartReplaced), never taken for the host's or for a copy no leaf accounts for.
	// The loader that imported their files went with them, so the query is not held to its record: placing code on
	// nodes with no standing grants it nothing.
	if (runtime_checksPermissions(slothlet) && splitText(String(current), "_reload_")[0] !== splitText(tag, "_reload_")[0])
		return runtime_leavesAtFile(slothlet, path, tag, mount, true);
	return runtime_replacedCopyLeaves(slothlet, path, mount);
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
function runtime_leavesAtFile(slothlet, path, instance, mount, restartReplaced = false) {
	const held =
		WeakMapMethods.get(LEAF_FILES, slothlet) == null ? undefined : MapMethods.get(WeakMapMethods.get(LEAF_FILES, slothlet), path);
	if (!held) return [];
	const leaves = [];
	// A removed node keeps its place while the permission system is off: nothing is checked, and what it made runs as plain
	// JavaScript, `self` included (#726). The nodes a restart replaced are given only when asked for (see
	// runtime_taggedLeavesAtFile), and then alone: the code they stand for is refused through them.
	const keepGone = restartReplaced || !runtime_checksPermissions(slothlet);
	for (const reference of setValues(held)) {
		const wrapper = WeakRefMethods.deref(reference);
		if (!wrapper) {
			SetMethods.delete(held, reference);
			continue;
		}
		if (runtime_isGone(wrapper) && !keepGone) continue;
		// A node a restart replaced has no standing while the permission system is on, as a removed one has none: it
		// stands for nothing but code carrying the ID it was built under (see runtime_taggedLeavesAtFile).
		if (restartReplaced !== (slothlet.handlers?.apiManager?.isRestartReplaced?.(wrapper) === true)) continue;
		// The tag is the ID the node was built under: code of a copy a reload replaced carries the ID the instance had then.
		if (instance && runtime_builtUnder(wrapper) !== instance) continue;
		if (mount && wrapper.____slothletInternal.moduleID !== mount) continue;
		// Code carrying the instance's tag but no mount's runs in the copy a raw `import` of the leaf's file loads (#691):
		// a module of its own, which slothlet loaded for no leaf, as frame placement reads it inside a call.
		if (instance && !mount && wrapper.____slothletInternal.moduleID) continue;
		listPush(leaves, wrapper);
	}
	return leaves;
}

/**
 * Every live node of an instance built from a file (see {@link registerLeafFile}): the file's own node and every node
 * of its values, for a checkpoint of what the file exports (see `helpers/run-snapshot`).
 * @param {object} slothlet - The instance.
 * @param {string} filePath - The file.
 * @returns {object[]} The nodes' wrappers.
 * @private
 */
function fileNodes(slothlet, filePath) {
	const files = WeakMapMethods.get(LEAF_FILES, slothlet);
	const held = files === undefined || !filePath ? undefined : MapMethods.get(files, toComparablePath(filePath));
	const nodes = [];
	if (held === undefined) return nodes;
	for (const reference of setValues(held)) {
		const wrapper = WeakRefMethods.deref(reference);
		if (wrapper === undefined) SetMethods.delete(held, reference);
		else listPush(nodes, wrapper);
	}
	return nodes;
}

/**
 * The functions found in the copies of an instance's leaf files that a module's own import or require loaded (see
 * {@link leafOfCopy}), each with the file and the place in its exports it holds: a WeakRef of the instance, the file
 * (as {@link LEAF_FILES} keys it), and the export path joined by NUL.
 * @type {WeakMap<Function, {slothlet: WeakRef<object>, file: string, key: string}>}
 * @private
 */
const COPY_FUNCTIONS = new WeakMap();

/**
 * Per instance: what {@link runtime_indexLeafCopies} last looked at — the instance ID, how many leaf files and copies
 * there were, the size of vitest's module record — and the files whose copies could not all be read yet.
 * @type {WeakMap<object, {instanceID: string, files: number, copies: number, runner: number, pending: Set<string>}>}
 * @private
 */
const COPY_INDEX_STATES = new WeakMap();

/**
 * vitest's module record's maps, read as they are kept: the runner adds each module it evaluates to them.
 * @type {{files: Map<string, Set<object>>|null, ids: Map<string, object>|null}}
 * @private
 */
const RUNNER_MAPS = (() => {
	const files = RUNNER_MODULES ? Reflect.getOwnPropertyDescriptor(RUNNER_MODULES, "fileToModulesMap")?.value : undefined;
	const ids = RUNNER_MODULES ? Reflect.getOwnPropertyDescriptor(RUNNER_MODULES, "idToModuleMap")?.value : undefined;
	return { files: util.types.isMap?.(files) ? files : null, ids: util.types.isMap?.(ids) ? ids : null };
})();

/**
 * A data property of an object, read from its descriptor so no getter runs; undefined for an accessor or none.
 * @param {object} holder - The object.
 * @param {string} key - The key.
 * @returns {*} The value.
 * @private
 */
function runtime_dataOf(holder, key) {
	const descriptor = Reflect.getOwnPropertyDescriptor(holder, key);
	return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/**
 * The copies vitest's runner evaluated of a file for an instance (the modules whose id carries the instance's query),
 * as {@link instanceCopyExports} reports copies.
 * @param {string} instanceID - The instance.
 * @param {string} file - The file's path.
 * @returns {Array<{commonJS: boolean, value: *, runner: true}|{pending: true}>} The copies.
 * @private
 */
function runtime_runnerCopies(instanceID, file) {
	const found = [];
	const held = RUNNER_MAPS.files === null ? undefined : MapMethods.get(RUNNER_MAPS.files, file);
	if (held === undefined || !util.types.isSet?.(held)) return found;
	for (const node of setValues(held)) {
		if (node === null || typeof node !== "object" || util.types.isProxy(node)) continue;
		const id = runtime_dataOf(node, "id");
		if (typeof id !== "string") continue;
		const cut = StringMethods.indexOf(id, "?");
		if (cut === -1) continue;
		if (URLSearchParamsMethods.get(new URLSearchParams(StringMethods.slice(id, cut + 1)), "slothlet_instance") !== instanceID) continue;
		const exports = runtime_dataOf(node, "exports");
		if (runtime_dataOf(node, "evaluated") !== true || exports === null || typeof exports !== "object") listPush(found, { pending: true });
		else listPush(found, { commonJS: false, value: exports, runner: true });
	}
	return found;
}

/**
 * Record the functions one copy of a leaf file exports (see {@link COPY_FUNCTIONS}), at the export paths the loader
 * gives a node built from the file (see `ownership.indexModuleExports`): a named export at its name, the default
 * export at `default` (a CommonJS file's `module.exports`), and a function held directly by either at its key under it.
 * A function a node was built from is left to that node.
 * @param {object} slothlet - The instance.
 * @param {string} file - The file, as {@link LEAF_FILES} keys it.
 * @param {{commonJS: boolean, value: *, runner?: boolean}} copy - The copy's exports.
 * @returns {void}
 * @private
 */
function runtime_indexCopy(slothlet, file, copy) {
	const reference = new WeakRef(slothlet);
	const add = (fn, key) => {
		if (typeof fn !== "function" || WeakMapMethods.has(trustedRootOwn.implWrappers, fn) || WeakMapMethods.has(COPY_FUNCTIONS, fn)) return;
		WeakMapMethods.set(COPY_FUNCTIONS, fn, { slothlet: reference, file, key });
	};
	const members = (holder, prefix) => {
		if (holder === null || (typeof holder !== "object" && typeof holder !== "function") || util.types.isProxy(holder)) return;
		for (let ofIndex = 0, ofList = Reflect.ownKeys(holder); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (typeof key === "string") add(runtime_dataOf(holder, key), prefix + "\u0000" + key);
		}
	};
	const value = copy.value;
	try {
		if (copy.commonJS) {
			add(value, "default");
			members(value, "default");
			return;
		}
		if (value === null || typeof value !== "object") return;
		for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (typeof key !== "string" || key === "module.exports") continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			let binding;
			if (descriptor && "value" in descriptor) binding = descriptor.value;
			else if (copy.runner && typeof descriptor?.get === "function") {
				// vite's module runner exposes each binding through the getter it writes for it.
				try {
					binding = Reflect.apply(descriptor.get, value, []);
				} catch {
					continue;
				}
			} else continue;
			add(binding, key);
			members(binding, key);
		}
	} catch {
		// A namespace with a binding not initialised yet holds nothing to record past it.
	}
}

/**
 * Bring an instance's {@link COPY_FUNCTIONS} up to date: when a leaf file or a copy of a file was loaded since it was
 * last done, the copies of every leaf file are read again; otherwise only the files a copy of which could not be read
 * yet are.
 * @param {object} slothlet - The instance.
 * @returns {void}
 * @private
 */
function runtime_indexLeafCopies(slothlet) {
	const files = WeakMapMethods.get(LEAF_FILES, slothlet);
	const instanceID = slothlet.instanceID;
	if (files === undefined || typeof instanceID !== "string") return;
	const counts = {
		instanceID,
		files: MapMethods.size(files),
		copies: instanceCopyCount(instanceID),
		runner: RUNNER_MAPS.ids === null ? 0 : MapMethods.size(RUNNER_MAPS.ids)
	};
	const last = WeakMapMethods.get(COPY_INDEX_STATES, slothlet);
	const unchanged =
		last !== undefined &&
		last.instanceID === counts.instanceID &&
		last.files === counts.files &&
		last.copies === counts.copies &&
		last.runner === counts.runner;
	if (unchanged && !SetMethods.size(last.pending)) return;
	const state = { ...counts, pending: new Set() };
	WeakMapMethods.set(COPY_INDEX_STATES, slothlet, state);
	for (const file of mapKeys(files)) {
		if (unchanged && !SetMethods.has(last.pending, file)) continue;
		const copies = concatLists(instanceCopyExports(instanceID, file), runtime_runnerCopies(instanceID, file));
		for (let ofIndex = 0, ofList = copies; ofIndex < ofList.length; ofIndex++) {
			const copy = ofList[ofIndex];
			if (copy.pending) SetMethods.add(state.pending, file);
			else runtime_indexCopy(slothlet, file, copy);
		}
	}
}

/**
 * The node whose leaf function a function is the copy of (option a of the hand-out rule): a module that imports or
 * requires a leaf's file itself gets a module of its own (see `propagateInstanceQuery` in `helpers/instance-imports`),
 * so the function it holds is not the one the node was built from, though it is the same export of the same file. A
 * call of it is a call of that node, wherever it is reached. Null for any other function, and for a node that is gone.
 * Reads the instance's records of the copies it loaded, so nothing of the function or the copies' code runs.
 * @param {object} slothlet - The instance.
 * @param {*} fn - The function.
 * @returns {object|null} The node's wrapper.
 * @internal
 */
function leafOfCopy(slothlet, fn) {
	if (typeof fn !== "function" || !slothlet) return null;
	runtime_indexLeafCopies(slothlet);
	const entry = WeakMapMethods.get(COPY_FUNCTIONS, fn);
	if (entry === undefined || WeakRefMethods.deref(entry.slothlet) !== slothlet) return null;
	for (let ofIndex = 0, ofList = fileNodes(slothlet, entry.file); ofIndex < ofList.length; ofIndex++) {
		const wrapper = ofList[ofIndex];
		const internal = wrapper.____slothletInternal;
		if (typeof internal?.impl !== "function" || runtime_isGone(wrapper)) continue;
		const exportPath = internal.exportPath;
		if (Arrays.isArray(exportPath) && ArrayMethods.join(mapList(exportPath, String), "\u0000") === entry.key) return wrapper;
	}
	return null;
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
function runtime_codeWritersOnStack(slothlet) {
	const family = slothlet.instanceID;
	const sources = [{ family, slothlet, roots: [] }];
	// In the flow of framework work the instance does as the host, the code past the frame that work runs in asked for
	// it, and the change is the work's own.
	const store = slothlet.contextManager?.als?.getStore?.();
	const hostWork = store !== undefined && WeakMapMethods.get(HOST_WORK_STORES, store) === slothlet;
	for (const frame of framesOf(runtime_captureFrames(48))) {
		if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
			if (hostWork && runtime_isHostWorkFrame(frame)) return [];
			continue;
		}
		if (StringMethods.startsWith(frame.path, "node:")) continue;
		if (frame.evaluated || isForeignScript(frame)) return stackHoldsInstanceCode(sources) ? null : [];
		const leaves = runtime_leavesAt(slothlet, frame);
		if (leaves.length) return leaves;
		const tag = runtime_frameInstanceTag(frame.line);
		if (tag && StringMethods.startsWith(tag, splitText(String(family), "_reload_")[0])) return null;
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
 * @param {Iterable<object>|null} [capture=null] - A capture already taken at this same point, inside slothlet's own code
 *   (the live runtime's, placing a waiting call): read in place of the first, short one. Only slothlet's own frames on
 *   top differ, and those are passed over, so it reads the same frames the short one would, a few further out at most.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}|{unaccounted: true}|null} The leaf whose code it is
 *   and its ceiling, unaccounted code, or null when the leaf's own code (or the host's) is running.
 * @private
 */
function runtime_foreignCodeRunning(record, capture = null) {
	const leaf = record.wrapper;
	const description = describeCall(leaf);
	if (!description.filePath) return null;
	const fileless = runtime_isHostObjectLeaf(leaf, description.filePath);
	const entryOf = (wrapper, call) => ({
		...describeCall(wrapper),
		currentWrapper: wrapper,
		family: runtime_builtUnder(wrapper),
		distance: 0,
		record: call
	});
	// A pinned call (a slothlet function a module read, run by another) carries the calls it runs under as its ceiling:
	// their code calling it is accounted for, held to them already.
	const ceilings = filterList(
		ceilingMembers(record.ceiling),
		(wrapper) =>
			wrapper && wrapper !== leaf && WeakSetMethods.has(trustedRootOwn.genuineWrappers, wrapper) && describeCall(wrapper).filePath
	);
	let cached = ceilings.length ? null : WeakMapMethods.get(SINGLE_PLACERS, leaf);
	if (!cached || cached.description !== description) {
		const { place } = createFramePlacer(
			concatLists(
				[entryOf(leaf, record)],
				mapList(ceilings, (wrapper) => entryOf(wrapper, null))
			)
		);
		cached = { description, place };
		if (!ceilings.length) WeakMapMethods.set(SINGLE_PLACERS, leaf, cached);
	}
	// `whole` says the capture reaches as far as the answer may need: a short first capture settles only what its own
	// frames decide, and leaves anything that reads the frames further out to the full one.
	const decide = (frames, whole) => {
		// Whether a builtin ran between the innermost code of anyone's (slothlet's own included) and the frames read
		// since, which are only Node's own: Node's code calling a builtin acts for no one more than the builtin does.
		let builtinSince = false;
		let index = -1;
		// Slothlet's own frames are passed over by their path and what they enter alone, so they are read no further.
		for (const frame of framesOf(!Arrays.isArray(frames) && typeof frames.lean === "function" ? frames.lean() : frames)) {
			index++;
			if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
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
			if (StringMethods.startsWith(frame.path, "node:")) {
				if (runtime_isNodeScript(frame)) {
					builtinSince ||= frame.gap;
					continue;
				}
				return UNACCOUNTED_SUPPLIER;
			}
			const placement = cached.place(frame);
			if (placement?.matches.length) return isUnverifiedCode(frame, placement) ? UNACCOUNTED_SUPPLIER : null;
			if (!whole) return undefined;
			// Code of no module's folder and no instance: a file some module loaded is that module's. A package the call's
			// own code loads, and the host's own code, act for the code that called them, as Node's own code does: the next
			// frame out decides, so a function another module handed in that has a package call a node is told as that
			// module's code, with or without the package between, and the call's own code calling a package is the call's.
			// A browser cannot tell a package's frame from any other, and reads past it too. Frames of it past what is read
			// leave whose access it is unknown. Inside a leaf with no file such code is the leaf's own (#717).
			if (!placement) {
				const answer = isNode ? runtime_packageAnswer(record, frame, fileless) : null;
				if (answer === null && !fileless) continue;
				return answer;
			}
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
	const near = capture ?? runtime_captureFrames(NEAR_FRAMES);
	const settled = decide(near, !near.truncated);
	if (settled !== undefined || !near.truncated) return settled ?? null;
	const full = decide(runtime_captureFrames(48), true);
	if (full !== undefined) return full;
	// Cut off inside slothlet's and Node's own frames, with the stack going on: the code making the access was not
	// reached (Node's own code recursing, say `util.inspect` deep in a value, calls an api function from the bottom of
	// it). It is read further out, and when that still reaches no one's code nothing says whose access it is: it is
	// refused, not taken to be the leaf's own, and not settled by a node a module read and kept either.
	const far = decide(runtime_captureFrames(FAR_FRAMES), true);
	return far === undefined ? REFUSED_SUPPLIER : far;
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
	const { place } = createFramePlacer([{ ...description, currentWrapper: leaf, family: runtime_builtUnder(leaf), distance: 0, record }]);
	// The frames that decide sit near the top of the stack: the capture is widened only when it was cut short first.
	const decide = (frames) => {
		for (const frame of framesOf(frames)) {
			if (StringMethods.startsWith(frame.path, FRAMEWORK_DIR + "/")) {
				if (frame.enter) return null;
				continue;
			}
			if (frame.async || isRunnerFrame(frame)) return null;
			const placement = place(frame);
			// Code placed by its plain path that does not run the file's own source is no one's (#691).
			if (placement?.matches.length && isUnverifiedCode(frame, placement)) return UNACCOUNTED_SUPPLIER;
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
 * `permissions.caller.ceiling: "chain"`, under every call from the leaf up to it and every ceiling those calls and its own call
 * carried.
 * @param {{wrapper: object, parent: object|null, ceiling?: object|null}} record - The leaf's call.
 * @param {{currentWrapper: object, record: object}} supplier - The supplier's call.
 * @returns {{wrapper: object, ceiling: object|ReadonlyArray<object>}} The answer.
 * @private
 */
function runtime_supplierAnswer(record, supplier) {
	// By default the supplier is held to the leaf its code is running inside; `permissions.caller.ceiling: "chain"` carries
	// every call it was handed through, and the ceilings they carried, as well.
	if (record.wrapper.slothlet?.config?.permissions?.caller?.ceiling !== "chain")
		return { wrapper: supplier.currentWrapper, ceiling: record.wrapper };
	const parts = [supplier.record.ceiling];
	for (let current = record, depth = 0; current && current !== supplier.record && depth < MAX_CHAIN; current = current.parent, depth++) {
		listPush(parts, current.wrapper, current.ceiling);
	}
	const members = filterList(
		ceilingMembers(Reflect.apply(combineCeilings, undefined, parts)),
		(member) => member !== supplier.currentWrapper
	);
	return { wrapper: supplier.currentWrapper, ceiling: Reflect.apply(combineCeilings, undefined, members) };
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
		for (let ofIndex = 0, ofList = Objects.entries(Processes.binding("natives")); ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				id = ofEntry[0],
				source = ofEntry[1];
			if (typeof source === "string") MapMethods.set(NODE_SOURCES, id, source);
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
	if (MapMethods.get(NODE_SCRIPTS, frame.path) == null ? undefined : SetMethods.has(MapMethods.get(NODE_SCRIPTS, frame.path), frame.hash))
		return true;
	const id = StringMethods.slice(frame.path, "node:".length);
	const source = MapMethods.get(NODE_SOURCES, id);
	if (source === undefined) return false;
	let hash = MapMethods.get(NODE_SOURCE_HASHES, id);
	if (hash === undefined) {
		hash = sha256(source, "utf8");
		MapMethods.set(NODE_SOURCE_HASHES, id, hash);
	}
	return frame.hash === hash;
}

/**
 * Record the `node:` scripts on the stack right now as Node's own (see {@link NODE_SCRIPTS}).
 * @returns {void}
 * @private
 */
function runtime_sampleNodeScripts() {
	for (const frame of framesOf(runtime_captureFrames(64))) {
		if (!StringMethods.startsWith(frame.path, "node:") || !frame.hash || frame.evaluated) continue;
		let hashes = MapMethods.get(NODE_SCRIPTS, frame.path);
		if (!hashes) MapMethods.set(NODE_SCRIPTS, frame.path, (hashes = new Set()));
		SetMethods.add(hashes, frame.hash);
	}
}

/**
 * `AsyncLocalStorage` and its `run` and `exit`, taken as slothlet loads, for {@link sampleStoreScripts}: a store is
 * sampled only once an instance selects the async runtime, by then module code may have replaced the class's methods,
 * and these are what the sample runs. Null where the platform has no `node:async_hooks`.
 * @type {{Storage: Function, run: Function, exit: Function}|null}
 * @private
 */
let STORE_SAMPLE = null;

/**
 * Whether {@link sampleStoreScripts} has run.
 * @type {boolean}
 * @private
 */
let storeSampled = false;

/**
 * Record the scripts of Node's own code that run a store's callback (`AsyncLocalStorage#run` and `#exit`) as Node's own
 * (see {@link NODE_SCRIPTS}). Not done as slothlet loads: on Node 22 a store that has run switches async hooks on for the
 * whole process, and the live runtime runs no store. The async runtime's manager calls it once, as it makes its store,
 * which happens when the first instance on the async runtime is being created, before any file of that instance loads.
 * The class and its methods are the ones taken as slothlet loaded, run on a store of its own, so nothing a module
 * changed since runs inside the sample.
 * @returns {void}
 * @private
 */
function sampleStoreScripts() {
	if (storeSampled || !STORE_SAMPLE) return;
	storeSampled = true;
	const { Storage, run, exit } = STORE_SAMPLE;
	try {
		const storage = new Storage();
		// Its own `run`: Node's `exit` can call `this.run`, which reads the prototype a module may have changed.
		Objects.defineProperty(storage, "run", { __proto__: null, value: run, writable: true, configurable: true });
		Reflect.apply(run, storage, [{}, runtime_sampleNodeScripts]);
		Reflect.apply(run, storage, [{}, () => Reflect.apply(exit, storage, [runtime_sampleNodeScripts])]);
	} catch {
		// A sample that fails leaves its scripts unrecorded: their frames are then refused, which fails closed.
	}
}

if (isNode) {
	// Sampled through each way Node's own code calls back into code it was handed: reading a getter (`util.inspect`),
	// emitting (`EventEmitter`), and its timer and tick queues. Running a store (`AsyncLocalStorage`) is sampled when the
	// async runtime makes its store ({@link sampleStoreScripts}).
	const builtin = (id) => Processes.getBuiltinModule(id);
	// Taken here, as slothlet loads; the samples below run now.
	const { inspect } = builtin("node:util");
	const { AsyncLocalStorage } = builtin("node:async_hooks");
	if (typeof AsyncLocalStorage === "function") {
		STORE_SAMPLE = { Storage: AsyncLocalStorage, run: AsyncLocalStorage.prototype.run, exit: AsyncLocalStorage.prototype.exit };
	}
	const { EventEmitter } = builtin("node:events");
	const nodeSetTimeout = builtin("node:timers").setTimeout;
	for (
		let ofIndex = 0,
			ofList = [
				() =>
					inspect(
						{
							get value() {
								runtime_sampleNodeScripts();
								return 0;
							}
						},
						{ getters: true }
					),
				() => {
					const emitter = new EventEmitter();
					emitter.on("sample", runtime_sampleNodeScripts);
					emitter.emit("sample");
				},
				() => nodeSetTimeout(runtime_sampleNodeScripts, 0).unref(),
				() => Processes.nextTick(runtime_sampleNodeScripts)
			];
		ofIndex < ofList.length;
		ofIndex++
	) {
		const sample = ofList[ofIndex];
		try {
			sample();
		} catch {
			// A sample that fails leaves its scripts unrecorded: their frames are then refused, which fails closed.
		}
	}
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (
		!mayTakeInternals(consumer, [
			"lib/builders/api_builder",
			"lib/handlers/context-async",
			"lib/handlers/context-live",
			"lib/handlers/unified-wrapper",
			"lib/helpers/class-instance-wrapper",
			"lib/processors/loader",
			"slothlet"
		])
	)
		throw ownBindingsRefusal("lib/handlers/frame-placement", import.meta.url);
	return {
		attributeResult,
		createFramePlacer,
		createModuleLoad,
		describeCall,
		enterCall,
		fileNodes,
		forgetInstanceScripts,
		frameDefiner,
		handedLeafFunctions,
		isLeafFileFunction,
		leafOfCopy,
		loadOnStack,
		outerCallerCeiling,
		ownReceiver,
		recordInstanceOwner,
		registerLeafFile,
		runAsHostWork,
		resolveSupplier,
		runningOutsideFlow,
		runtime_captureFrames,
		scopeEnteredByCode,
		sampleStoreScripts,
		runtime_codeWritersOnStack,
		runtime_loadingFileRunning,
		runtime_loadingHelper,
		setApiValueCheck,
		setHandedOutCheck,
		setHostPrototypeCheck,
		setInboundOriginal,
		setModuleNodeResolver,
		setResultAttributor,
		stackHoldsInstanceCode,
		supplierChainCeiling
	};
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof runtime_importedLocations} */
const guarded_runtime_importedLocations = guardInternal(runtime_importedLocations, "runtime_importedLocations", import.meta.url);
/** @type {typeof runtime_realComparablePath} */
const guarded_runtime_realComparablePath = guardInternal(runtime_realComparablePath, "runtime_realComparablePath", import.meta.url);
/** @type {typeof runtime_entryNames} */
const guarded_runtime_entryNames = guardInternal(runtime_entryNames, "runtime_entryNames", import.meta.url);
/** @type {typeof runtime_captureFrames} */
const guarded_runtime_captureFrames = guardInternal(runtime_captureFrames, "runtime_captureFrames", import.meta.url);
/** @type {typeof forgetInstanceScripts} */
const guarded_forgetInstanceScripts = guardInternal(forgetInstanceScripts, "forgetInstanceScripts", import.meta.url);
/** @type {typeof enterCall} */
const guarded_enterCall = guardInternal(enterCall, "enterCall", import.meta.url);
/** @type {typeof describeCall} */
const guarded_describeCall = guardInternal(describeCall, "describeCall", import.meta.url);
/** @type {typeof createFramePlacer} */
const guarded_createFramePlacer = guardInternal(createFramePlacer, "createFramePlacer", import.meta.url);
/** @type {typeof stackHoldsInstanceCode} */
const guarded_stackHoldsInstanceCode = guardInternal(stackHoldsInstanceCode, "stackHoldsInstanceCode", import.meta.url);
/** @type {typeof setApiValueCheck} */
const guarded_setApiValueCheck = guardInternal(setApiValueCheck, "setApiValueCheck", import.meta.url);
/** @type {typeof setResultAttributor} */
const guarded_setResultAttributor = guardInternal(setResultAttributor, "setResultAttributor", import.meta.url);
/** @type {typeof attributeResult} */
const guarded_attributeResult = guardInternal(attributeResult, "attributeResult", import.meta.url);
/** @type {typeof setHostPrototypeCheck} */
const guarded_setHostPrototypeCheck = guardInternal(setHostPrototypeCheck, "setHostPrototypeCheck", import.meta.url);
/** @type {typeof setHandedOutCheck} */
const guarded_setHandedOutCheck = guardInternal(setHandedOutCheck, "setHandedOutCheck", import.meta.url);
/** @type {typeof setInboundOriginal} */
const guarded_setInboundOriginal = guardInternal(setInboundOriginal, "setInboundOriginal", import.meta.url);
/** @type {typeof handedLeafFunctions} */
const guarded_handedLeafFunctions = guardInternal(handedLeafFunctions, "handedLeafFunctions", import.meta.url);
/** @type {typeof supplierChainCeiling} */
const guarded_supplierChainCeiling = guardInternal(supplierChainCeiling, "supplierChainCeiling", import.meta.url);
/** @type {typeof resolveSupplier} */
const guarded_resolveSupplier = guardInternal(resolveSupplier, "resolveSupplier", import.meta.url);
/** @type {typeof recordInstanceOwner} */
const guarded_recordInstanceOwner = guardInternal(recordInstanceOwner, "recordInstanceOwner", import.meta.url);
/** @type {typeof isInstanceOwnerFile} */
const guarded_isInstanceOwnerFile = guardInternal(isInstanceOwnerFile, "isInstanceOwnerFile", import.meta.url);
/** @type {typeof installViteHostRegistry} */
const guarded_installViteHostRegistry = guardInternal(installViteHostRegistry, "installViteHostRegistry", import.meta.url);
/** @type {typeof installViteLoadedRegistry} */
const guarded_installViteLoadedRegistry = guardInternal(installViteLoadedRegistry, "installViteLoadedRegistry", import.meta.url);
/** @type {typeof setModuleNodeResolver} */
const guarded_setModuleNodeResolver = guardInternal(setModuleNodeResolver, "setModuleNodeResolver", import.meta.url);
/** @type {typeof createModuleLoad} */
const guarded_createModuleLoad = guardInternal(createModuleLoad, "createModuleLoad", import.meta.url);
/** @type {typeof loadOnStack} */
const guarded_loadOnStack = guardInternal(loadOnStack, "loadOnStack", import.meta.url);
/** @type {typeof outerCallerCeiling} */
const guarded_outerCallerCeiling = guardInternal(outerCallerCeiling, "outerCallerCeiling", import.meta.url);
/** @type {typeof ownReceiver} */
const guarded_ownReceiver = guardInternal(ownReceiver, "ownReceiver", import.meta.url);
/** @type {typeof frameDefiner} */
const guarded_frameDefiner = guardInternal(frameDefiner, "frameDefiner", import.meta.url);
/** @type {typeof isLeafFileFunction} */
const guarded_isLeafFileFunction = guardInternal(isLeafFileFunction, "isLeafFileFunction", import.meta.url);
/** @type {typeof registerLeafFile} */
const guarded_registerLeafFile = guardInternal(registerLeafFile, "registerLeafFile", import.meta.url);
/** @type {typeof runtime_loadingFileRunning} */
const guarded_runtime_loadingFileRunning = guardInternal(runtime_loadingFileRunning, "runtime_loadingFileRunning", import.meta.url);
/** @type {typeof runtime_codeWritersOnStack} */
const guarded_runtime_codeWritersOnStack = guardInternal(runtime_codeWritersOnStack, "runtime_codeWritersOnStack", import.meta.url);
export {
	guarded_runtime_importedLocations as runtime_importedLocations,
	guarded_runtime_realComparablePath as runtime_realComparablePath,
	guarded_runtime_entryNames as runtime_entryNames,
	guarded_runtime_captureFrames as runtime_captureFrames,
	guarded_forgetInstanceScripts as forgetInstanceScripts,
	guarded_enterCall as enterCall,
	guarded_describeCall as describeCall,
	guarded_createFramePlacer as createFramePlacer,
	guarded_stackHoldsInstanceCode as stackHoldsInstanceCode,
	guarded_setApiValueCheck as setApiValueCheck,
	guarded_setResultAttributor as setResultAttributor,
	guarded_attributeResult as attributeResult,
	guarded_setHostPrototypeCheck as setHostPrototypeCheck,
	guarded_setHandedOutCheck as setHandedOutCheck,
	guarded_setInboundOriginal as setInboundOriginal,
	guarded_handedLeafFunctions as handedLeafFunctions,
	guarded_supplierChainCeiling as supplierChainCeiling,
	guarded_resolveSupplier as resolveSupplier,
	guarded_recordInstanceOwner as recordInstanceOwner,
	guarded_isInstanceOwnerFile as isInstanceOwnerFile,
	guarded_installViteHostRegistry as installViteHostRegistry,
	guarded_installViteLoadedRegistry as installViteLoadedRegistry,
	guarded_setModuleNodeResolver as setModuleNodeResolver,
	guarded_createModuleLoad as createModuleLoad,
	guarded_loadOnStack as loadOnStack,
	guarded_outerCallerCeiling as outerCallerCeiling,
	guarded_ownReceiver as ownReceiver,
	guarded_frameDefiner as frameDefiner,
	guarded_isLeafFileFunction as isLeafFileFunction,
	guarded_registerLeafFile as registerLeafFile,
	guarded_runtime_codeWritersOnStack as runtime_codeWritersOnStack,
	guarded_runtime_loadingFileRunning as runtime_loadingFileRunning
};
