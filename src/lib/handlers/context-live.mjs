/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/context-live.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T21:19:19-07:00 (1792210759)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live bindings context manager (no AsyncLocalStorage)
 * @module @cldmv/slothlet/handlers/context-live
 * @internal
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { setApiContextChecker } from "@cldmv/slothlet/helpers/eventemitter-context";
import { setApiCallerPinner } from "@cldmv/slothlet/helpers/caller-pinning";
import { TRUSTED_ROOT, buildCapturedFlowStore } from "#handlers/trusted-root";
import { nativeThen } from "@cldmv/slothlet/helpers/promise-context";
import { isNode, util } from "@cldmv/slothlet/helpers/platform";
import { instanceCommonJSFiles, instanceCommonJSVersion, instanceImporters } from "@cldmv/slothlet/helpers/instance-imports";

/**
 * Stack resolution found a frame naming more than one suspended call, so which of them is
 * executing cannot be determined. Distinct from "no frame matched", which merely means the caller
 * is not one of the suspended calls — see {@link LiveContextManager#getCallerIdentity}.
 * @type {symbol}
 * @private
 */
const AMBIGUOUS = Symbol("slothlet.callerIdentity.ambiguous");

/**
 * Marks a call pinned to the host (`runInContext(..., asHost)`, from `lockCaller.caller()` when the
 * pinned caller is the host) on the running-call stack. Unlike a context-only entry, which is looked
 * through, it answers "no module caller": the pinned callback runs as the host even when a module
 * invoked it synchronously.
 */
const HOST_ENTRY = Symbol("slothlet.callerIdentity.host");

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
/**
 * The live manager that most recently registered the EventEmitter hooks.
 *
 * The helper's hooks are module-level, matching the existing context-checker registration, so a
 * pinned listener resolves the manager through this rather than capturing `this` — the listener can
 * outlive the call that registered it.
 * @type {LiveContextManager|null}
 * @private
 */
let liveContextManagerRef = null;

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
function runtime_importedLocations(wrapper, filePath) {
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
function runtime_realComparablePath(filePath) {
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
function runtime_entryNames(apiPath, currentWrapper) {
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
function runtime_namesEntry(head, entry) {
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
	const tag = /[?&]module=([^&#:)\s]+)/.exec(line)?.[1];
	if (!tag) return null;
	try {
		return decodeURIComponent(tag);
	} catch {
		// A malformed escape cannot name a moduleID other than as spelled.
		return tag;
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
 * @returns {Iterable<{head: string, path: string, line: string}> & {truncated: boolean}} The frames.
 * @private
 */
function runtime_captureFrames(limit) {
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
		if (frame) frames.push({ ...frame, line, async: /^at async /.test(line.trim()) });
	}
	frames.truncated = frames.length >= limit;
	return frames;
}

/**
 * V8's `prepareStackTrace` hook for {@link runtime_captureFrames}: the call sites as frames, without
 * formatting them.
 * @param {Error} _error - The error being captured.
 * @param {Array<object>} callSites - V8 call sites, innermost first.
 * @returns {Array<{head: string, path: string, line: string}>} The frames.
 * @private
 */
function runtime_structuredFrames(_error, callSites) {
	// Converted as the resolver walks them, innermost first: it usually stops within the first few.
	return {
		[Symbol.iterator]: function* frames() {
			for (const site of callSites) {
				// An eval'd frame names the file it was evaluated from in its origin, as the formatted text does.
				const location = site.getScriptNameOrSourceURL?.() ?? site.getFileName?.() ?? null;
				const origin = site.isEval?.() ? String(site.getEvalOrigin?.() ?? "") : "";
				if (!location && !origin) continue;
				const typeName = site.isToplevel?.() ? null : site.getTypeName?.();
				const name = site.getFunctionName?.() ?? site.getMethodName?.() ?? "";
				const head = `at ${site.isAsync?.() ? "async " : ""}${typeName && name ? `${typeName}.` : ""}${name}`;
				yield {
					head,
					path: runtime_comparableLocation(location ?? origin),
					line: `${head} (${location ?? ""}) ${origin}`,
					async: Boolean(site.isAsync?.())
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
const FRAMEWORK_DIR = toComparablePath(new URL("../../", import.meta.url).href);

/**
 * Live bindings context manager (direct global state)
 * Uses direct instance tracking without AsyncLocalStorage overhead.
 *
 * Concurrency boundary: the active instance is tracked in a single global field
 * ({@link LiveContextManager#currentInstanceID}), so this manager isolates *sequential*
 * `run()`/`scope()` calls (each restores the prior instance on exit) but NOT *interleaved*
 * concurrent calls on the same instance — across an `await`, a sibling `run()` overwrites the
 * global and a resumed callback reads the wrong context. True per-async-flow isolation requires
 * AsyncLocalStorage (see {@link module:@cldmv/slothlet/handlers/context-async}); the live manager
 * is the deliberate trade-off for environments without `node:async_hooks` (browser/worker, see
 * #123) and for the lowest-overhead single-flow case. See docs/CONTEXT-PROPAGATION.md.
 * @public
 */
export class LiveContextManager {
	/**
	 * The active-instance field as last written. Calls restore it in settle order, not entry order, so
	 * once calls overlap it can name an instance none of whose calls is running; readers go through
	 * {@link LiveContextManager#currentInstanceID}, which resolves past that.
	 * @type {string|null}
	 */
	#activeID = null;

	/**
	 * How many calls are executing synchronously right now, across every instance. While any is, the
	 * field is exact: it was set by the innermost entry, and a settle — the only out-of-order write —
	 * runs in a later job, never in the middle of synchronous code.
	 * @type {number}
	 */
	#syncDepth = 0;

	/**
	 * Stores with at least one suspended call, across every instance.
	 * @type {Set<object>}
	 */
	#busyStores = new Set();

	constructor() {
		this.instances = new Map(); // instanceID → context data
	}

	/**
	 * How many stores have a call suspended right now, across every instance.
	 * @type {number}
	 * @internal
	 */
	get suspendedStoreCount() {
		return this.#busyStores.size;
	}

	/**
	 * The instance whose flow is executing right now.
	 *
	 * The field behind it is one value shared by every instance and restored in settle order, so with
	 * two instances in flight it can be left naming the other one — and every reader that takes no
	 * instance id (the `self` and `context` bindings, the boundary pinner) would then resolve against
	 * the wrong instance (#592). It is trusted while code is executing synchronously inside a call, and
	 * while the only suspended calls belong to the instance it names. Otherwise the suspended calls of
	 * every instance are told apart from the call stack, the same way {@link LiveContextManager#getCallerIdentity}
	 * tells apart the calls of one; a stack that names none of them leaves the field's answer standing.
	 *
	 * Assigning sets the field directly.
	 *
	 * @type {string|null}
	 * @public
	 */
	get currentInstanceID() {
		return this.#resolveActiveID();
	}

	set currentInstanceID(value) {
		this.#activeID = value;
	}

	/**
	 * The base instance a store id belongs to: its own id, or the instance a `run()` / `scope()` /
	 * replayed-flow store was derived from.
	 * @param {string} instanceID - A store's id.
	 * @returns {string} The owning instance's id.
	 * @private
	 */
	#familyOf(instanceID) {
		return this.instances.get(instanceID)?.parentInstanceID ?? instanceID;
	}

	/**
	 * Resolve the executing instance — see {@link LiveContextManager#currentInstanceID}.
	 * @returns {string|null} The executing instance's store id, or the field when nothing better is known.
	 * @private
	 */
	#resolveActiveID() {
		const raw = this.#activeID;
		if (this.#syncDepth > 0 || this.#busyStores.size === 0) return raw;
		const rawFamily = raw === null ? null : this.#familyOf(raw);
		const families = new Set();
		for (const store of this.#busyStores) families.add(store.parentInstanceID ?? store.instanceID);
		if (families.size === 1 && families.has(rawFamily)) return raw;

		const candidates = new Set();
		for (const store of this.#busyStores) for (const entry of this.#suspendedFor(store)) candidates.add(entry);
		const resolved = this.#resolveSuspendedFromStack(candidates);
		// Code several instances' calls account for could be any of them: the field would pick one of them at
		// random, so no instance is active and the access is refused.
		if (resolved === AMBIGUOUS) return families.size > 1 ? null : raw;
		if (!resolved) return raw;
		// The field names a run()/scope() store of the resolved instance: that flow's own store wins.
		if (resolved.family === rawFamily && raw !== rawFamily) return raw;
		const id = resolved.store.instanceID;
		// The store can be gone already — a scope that exited while its call was still suspended.
		return this.instances.has(id) ? id : raw;
	}

	/**
	 * Calls that have suspended at an `await` and not yet settled, for one instance.
	 *
	 * `currentWrapper` is one mutable field per store, so it can only name one call, and it is
	 * restored call by call as each settles — in settle order, not entry order — so once calls
	 * overlap it can name a call that is not running, or one that has already finished. The set of
	 * calls actually in flight is what {@link LiveContextManager#getCallerIdentity} reasons from
	 * instead: one suspended call is necessarily the caller of anything that is not a synchronous
	 * entry; two or more are told apart from the call stack.
	 *
	 * Tracked on the store rather than the manager because the manager is a singleton shared by
	 * every instance: a set held there would treat two instances running concurrently as ambiguous
	 * with each other, even though each has its own `currentWrapper` and neither can overwrite the
	 * other's. A Set rather than a counter because the resolver needs the candidates themselves.
	 *
	 * @param {object} store - Instance context store.
	 * @returns {Set<object>} That instance's suspended-call set.
	 * @private
	 */
	#suspendedFor(store) {
		if (!store.__suspendedCalls) store.__suspendedCalls = new Set();
		return store.__suspendedCalls;
	}

	/**
	 * Module calls whose function body is executing synchronously right now, innermost last.
	 *
	 * A wrapper is pushed immediately before its function is applied and popped as soon as that
	 * application returns — for an async function, at its first `await`. While a wrapper is on this
	 * stack its code (or code it called synchronously) is what is running: an `await` continuation
	 * only ever resumes on an empty JavaScript stack, so no other flow can be executing underneath
	 * it. The top entry is therefore the caller, with no ambiguity to resolve — which is what makes a
	 * synchronously entered module (a nested leaf, or a `lockCaller`-pinned callback) attributable
	 * even while other calls are suspended and their async frames sit further down the stack (#512).
	 *
	 * @param {object} store - Instance context store.
	 * @returns {Array<object|symbol|null>} That store's synchronously-entered wrappers (`null` for a context-only entry, `HOST_ENTRY` for a host pin).
	 * @private
	 */
	#enteredFor(store) {
		if (!store.__enteredCalls) store.__enteredCalls = [];
		return store.__enteredCalls;
	}

	/**
	 * The identity a store carries when no module call is in flight on it.
	 *
	 * For an instance's base store that is no caller at all (host-initiated). For a `run()`/`scope()`
	 * store it is the caller inherited from the store it was derived from, so a module-initiated scope
	 * stays attributed to that module. Captured the first time the store is seen — before any call can
	 * have changed `currentWrapper` — because afterwards the field can be left naming a finished call.
	 *
	 * @param {object} store - Instance context store.
	 * @returns {object|null} The store's resting caller.
	 * @private
	 */
	#baselineFor(store) {
		if (!Object.prototype.hasOwnProperty.call(store, "__baselineWrapper")) store.__baselineWrapper = store.currentWrapper ?? null;
		return store.__baselineWrapper;
	}

	/**
	 * Resolve the caller identity for the call that is executing right now.
	 *
	 * Enforcement asks for identity through here rather than reading `store.currentWrapper`
	 * directly, because that field can only name one call and is restored out of order once calls
	 * overlap. In order:
	 *
	 * - **A synchronously entered call** — the top of the entered stack is executing now and is the
	 *   answer outright, however many other calls are suspended (see {@link LiveContextManager#enteredFor}).
	 * - **No call in flight** — the store's baseline: the host for an instance store, the inherited
	 *   caller for a `run()`/`scope()` store.
	 * - **One call suspended** — nothing else is in flight, so that call is the caller. The field is
	 *   not consulted: a call that settled after the synchronous caller that started it had returned
	 *   restores the field to that caller, which is then neither running nor suspended.
	 * - **Two or more suspended** — the true caller is taken from the call stack. The gated access
	 *   happens synchronously inside the resumed call's code, so a frame of it is on the stack;
	 *   interleaving can scramble a shared field, but not the stack, since each flow has its own.
	 *
	 * Only the suspended calls are candidates, so when the stack names none of them the caller is not
	 * one of the ambiguous calls and the baseline applies; when it names several it cannot tell apart,
	 * identity is reported as unresolved so enforcement fails closed rather than guessing.
	 *
	 * Live runtime only. The async manager scopes identity per flow with AsyncLocalStorage and has
	 * no such ambiguity.
	 *
	 * @param {string} [instanceID] - When provided, resolve identity from THIS instance's own store
	 *   rather than from whichever instance is globally active. The manager is a singleton shared by
	 *   every instance, so the global `currentInstanceID` can point at a different `slothlet()` at the
	 *   moment this instance's access is enforced — either an outer leaf mid-boot of this nested
	 *   instance (its base store has no caller → treated as uncalled) or a concurrent sibling that
	 *   transiently overwrote the global while this instance's own call is parked at an `await` (its
	 *   store still holds the in-flight caller → resolved and enforced). Scoping the store keeps both
	 *   correct; a bare `currentInstanceID` read conflates them (#290). Omit for the legacy behavior.
	 * @returns {{currentWrapper: object|null, callerWrapper: object, unresolved?: boolean}|undefined}
	 *   Identity for the executing call, or undefined when there is no active context.
	 * @public
	 */
	getCallerIdentity(instanceID) {
		const store = this.tryGetContext(instanceID);
		/* v8 ignore next — callers reach this only with an active instance. */
		if (!store) return undefined;
		return this.#identityFor(store);
	}

	/**
	 * Resolve the caller identity for the call executing right now on one store — the resolution
	 * behind {@link LiveContextManager#getCallerIdentity}, for a store already in hand.
	 *
	 * @param {object} store - Instance context store.
	 * @returns {{currentWrapper: object|null, callerWrapper: object, unresolved?: boolean}} Identity for the executing call.
	 * @private
	 */
	#identityFor(store) {
		// An identity captured at a moment when it was known to be reliable wins outright. The lazy
		// waiting-proxy path resolves the caller synchronously, inside that caller's own frame, and
		// then defers the actual invocation to a later turn — by which point the caller's frame has
		// been released and the stack can no longer name it. Honouring the earlier capture keeps the
		// answer from degrading just because enforcement runs late.
		if (store.__authoritativeWrapper) {
			return { currentWrapper: store.__authoritativeWrapper, callerWrapper: store.callerWrapper };
		}
		// Innermost synchronous entry that names a module. An entry without a wrapper (a context-only
		// `runInContext`) does not change who is calling, so it is looked through. A host pin does:
		// the callback runs as the host, even when a module invoked it synchronously (#477).
		const entered = this.#enteredFor(store);
		for (let index = entered.length - 1; index >= 0; index--) {
			if (entered[index] === HOST_ENTRY) return { currentWrapper: null, callerWrapper: null };
			if (entered[index]) return { currentWrapper: entered[index], callerWrapper: store.callerWrapper };
		}

		const suspended = this.#suspendedFor(store);
		if (suspended.size === 0) return { currentWrapper: this.#baselineFor(store), callerWrapper: store.callerWrapper };
		// A suspended call's own caller is the one recorded when it entered: the store's caller field is
		// restored in settle order too, so once calls overlap it can name another call's caller.
		//
		// A lone suspended call is not assumed to be what is executing. Host code can run while it is
		// suspended — after the host's own `await`, or in a callback the host registered while nothing
		// was in flight, which nothing pinned — so it is resolved from the stack like any other (#601).
		// A host-pinned entry has no frame to match and keeps its own answer.
		if (suspended.size === 1) {
			const [only] = suspended;
			if (!only.filePath) return { currentWrapper: only.currentWrapper, callerWrapper: only.callerWrapper };
		}

		const resolved = this.#resolveSuspendedFromStack(suspended);
		// The stack could not tell which of several suspended calls is executing: a frame named more
		// than one of them (the same module suspended twice under different api paths, resuming in a
		// file they share), and no frame further out pinned a single one. Deny rather than pick: report
		// no caller AND mark it unresolved, so enforcement does not fall through to the host-initiated
		// exemption and hand it that privilege.
		if (resolved === AMBIGUOUS) {
			return { currentWrapper: null, callerWrapper: store.callerWrapper, unresolved: true };
		}
		if (resolved) return { currentWrapper: resolved.currentWrapper, callerWrapper: resolved.callerWrapper };

		// No suspended call is on the stack, so the caller is not one of them, and nothing entered
		// synchronously. What is running is the store's own resting flow — the host, or the scope's
		// inherited caller — never whichever call the field happens to name.
		return { currentWrapper: this.#baselineFor(store), callerWrapper: store.callerWrapper };
	}

	/**
	 * Who registered a deferred callback right now: the context it is pinned to.
	 *
	 * Stricter than {@link LiveContextManager#identityFor}. With calls suspended and nothing executing
	 * synchronously, that resolver takes a lone suspended call to be the caller — a guess, and for code
	 * the host runs between its own awaits a wrong one, which a pin would then make permanent (#595).
	 * Here a module is the answer only when the registration can be attributed to it: a call executing
	 * synchronously, or a suspended call whose code is on the stack. Anything else is the host.
	 *
	 * A stack that names several suspended calls it cannot tell apart is neither: the registration is
	 * module code, but of which call is unknown, and the host's standing is not handed to it. Such a
	 * callback is left unpinned, as before.
	 *
	 * @param {object} store - Instance context store.
	 * @returns {{wrapper: object|null, inFlight: boolean, ambiguous?: boolean}} The module to pin to (null
	 *   for the host), whether any call of the store is in flight — with none, a host registration needs
	 *   no pin — and whether the registration could not be attributed.
	 * @private
	 */
	#registrationIdentity(store) {
		const suspended = this.#suspendedFor(store);
		const entered = this.#enteredFor(store);
		const inFlight = suspended.size > 0 || entered.length > 0;
		if (store.__authoritativeWrapper) return { wrapper: store.__authoritativeWrapper, inFlight };
		for (let index = entered.length - 1; index >= 0; index--) {
			if (entered[index] === HOST_ENTRY) return { wrapper: null, inFlight };
			if (entered[index]) return { wrapper: entered[index], inFlight };
		}
		if (suspended.size === 0) return { wrapper: this.#baselineFor(store), inFlight };
		const resolved = this.#resolveSuspendedFromStack(suspended);
		if (resolved === AMBIGUOUS) return { wrapper: null, inFlight, ambiguous: true };
		return { wrapper: resolved ? resolved.currentWrapper : null, inFlight };
	}

	/**
	 * Module root folders for the instances the candidates belong to, longest first.
	 *
	 * Taken from each instance's module cache — the folder every `base`/`api.add()` module was loaded
	 * from — so a frame in any file of a module's folder can be attributed to that module, not only a
	 * frame in the exact file its suspended call entered through. Synthetic (in-memory) modules have
	 * no folder and contribute nothing. Longest first so a module mounted from inside another
	 * module's folder owns its own files.
	 *
	 * @param {Array<{currentWrapper: object}>} candidates - Suspended calls being resolved.
	 * @returns {Array<{moduleID: string, root: string}>} Module roots, longest first.
	 * @private
	 */
	#moduleRootsFor(candidates) {
		// Every candidate is a live wrapper, which always reaches its instance's cache; the optional
		// chain guards a partially-built wrapper handed in by a direct caller.
		/* v8 ignore next */
		const caches = new Set(candidates.map((entry) => entry.currentWrapper?.slothlet?.handlers?.apiCacheManager).filter(Boolean));
		// One instance's roots are kept between reads as they are; several instances' are merged, deepest first.
		if (caches.size === 1) return runtime_moduleRoots([...caches][0]);
		const roots = [];
		for (const cache of caches) roots.push(...runtime_moduleRoots(cache));
		return roots.sort((a, b) => b.root.length - a.root.length);
	}

	/**
	 * Pick which suspended call the current stack belongs to.
	 *
	 * Each frame is placed by its location (never by its function name alone, see {@link parseStackFrame}):
	 *
	 * - **a suspended call's file** — the file it entered through, or a URL the browser loader imported that
	 *   file from (a resolver's `blob:` / `data:` URL need not end in the manifest path);
	 * - **instance code** — a frame carrying an instance's import tag, or in one of its CommonJS copies, is
	 *   that instance's code, and belongs to the suspended calls of the instance whose leaves import its file
	 *   (the import graph the instance's resolve hook records). Instance code that no suspended call imports
	 *   is an orphan: some module is running that no suspended call accounts for;
	 * - **a module's folder** — an untagged frame (a browser leaf's own imports carry no tag) in a module's
	 *   root folder belongs to that module's suspended calls (#512); the deepest root wins, so a module
	 *   mounted inside another's folder owns its files.
	 *
	 * The code that is running is the job's: the outermost synchronous frame placed in any of these ways, the
	 * callback or resumed function the job started in. Frames inside it are helpers it called, so a module
	 * calling another module's helper stays itself. The `at async` frames past the synchronous part are the
	 * flows awaiting it; they only narrow a job placed among several calls, or place a job whose own frames
	 * are all unplaced. An orphan job is refused (AMBIGUOUS) rather than given another module's identity.
	 *
	 * Enforcement keys on the api path, so a frame settles the answer only when its matches share one. A
	 * frame in a suspended call's file can also pin one of several by the function name before its location.
	 * Narrowing that ends with several left is ambiguous and fails closed. Only when no frame on the stack is
	 * placed at all does a frame naming a suspended call's entry function place it: a package a leaf
	 * re-exports from, or code a browser leaf imports, runs inside that function or code it awaits.
	 *
	 * @param {Set<{currentWrapper: object, filePath: string|null, comparablePath: string, locations: Set<string>|null, moduleID: string|null, apiPath: string, fnName: string}>} suspended - Candidate calls.
	 * @returns {object|symbol|null} The matching entry, {@link AMBIGUOUS} when the stack cannot tell
	 *   several candidates apart or the running code is no suspended call's, or null when no frame names any
	 *   candidate.
	 * @private
	 */
	#resolveSuspendedFromStack(suspended) {
		// Host-pinned calls (`lockCaller.caller()` with no module caller) are tracked with no filePath:
		// they have no module frame to match. When only those are suspended, no candidate can match.
		const candidates = [...suspended].filter((entry) => entry.filePath);
		if (!candidates.length) return null;
		const roots = this.#moduleRootsFor(candidates);

		// Enforcement keys on the api path within one instance; across instances the same api path is a
		// different call, so the instance is part of what has to agree.
		const callKey = (entry) => `${entry.family ?? ""}\u0000${entry.apiPath}`;
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
		const isFileOf = (frame, entry) => isEntryLocation(frame.path, entry);

		// A frame's placement: `{ matches }` (the candidates it belongs to, possibly none: an orphan), or null
		// when the frame is no instance's code and in no module's folder. `byFile` marks a frame in a candidate's
		// own file, whose function name may pin one of several.
		const place = (frame) => {
			const frameInstance = runtime_frameInstanceTag(frame.line);
			// In Node slothlet loads every ES module of an instance under its tag, and knows its CommonJS files: an
			// untagged frame at a module's file is another copy of it — a package's or the host's own import — so
			// it is code no suspended call accounts for, not that module's.
			// A file the instance never loads under its tag (a helper reached through `#imports` or a package
			// self-reference, which are shared on purpose) is placed by its folder below.
			if (isNode && !frameInstance && !commonJSFamiliesAt(frame.path) && isInstanceFile(frame.path)) return { matches: [], byFile: false };
			// Two mounts of one folder share the file but not the copy: the frame's mount tag picks its call.
			const frameModule = runtime_frameModuleTag(frame.line);
			const byFile = candidates.filter(
				(entry) =>
					isFileOf(frame, entry) &&
					(!frameInstance || !entry.family || entry.family === frameInstance) &&
					(!frameModule || entry.moduleID === frameModule)
			);
			if (byFile.length) return { matches: byFile, byFile: true };
			const frameFamilies = frameInstance ? new Set([frameInstance]) : commonJSFamiliesAt(frame.path);
			if (frameFamilies) {
				const owners = candidates.filter((entry) => {
					if (!frameFamilies.has(entry.family)) return false;
					for (const importer of importersOf(entry.family, frame.path)) if (isEntryLocation(importer, entry)) return true;
					return false;
				});
				return { matches: owners, byFile: false };
			}
			const owner = roots.find(({ root }) => frame.path.startsWith(root + "/"));
			if (owner) return { matches: candidates.filter((entry) => entry.moduleID === owner.moduleID), byFile: false, byModule: true };
			return null;
		};

		const settle = (matches) => (new Set(matches.map(callKey)).size === 1 ? matches[0] : AMBIGUOUS);

		// The files the candidates' instances loaded under their tag: every leaf, and every file of their import
		// graphs. Built once per read, on first need.
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

		// The frames the microtask runner puts below a resumed function: a resumed function has nothing of its
		// own below it.
		const isRunnerFrame = (frame) =>
			frame.path.startsWith("node:internal/process/task_queues") || /\b(?:processTicksAndRejections|runMicrotasks)\b/.test(frame.head);

		// Returns the answer, or undefined when the frames read ran out before one could be given. The last read
		// (`final`) answers from the frames it has.
		const walk = (frames, final) => {
			const truncated = frames.truncated && !final;
			// Placed frames of the job's synchronous part, and of the flows awaiting it.
			const running = [];
			const awaiting = [];
			let syncEnded = false;
			let byName = null;
			// The synchronous frames below the outermost placed one: what started the job.
			let below = [];
			for (const frame of frames) {
				if (frame.path.startsWith(FRAMEWORK_DIR + "/")) continue;
				if (frame.async) syncEnded = true;
				const placement = place(frame);
				if (!syncEnded && !(placement && !(placement.byModule && !placement.matches.length))) below.push(frame);
				if (!placement) {
					if (!byName) {
						const named = candidates.filter((entry) => runtime_namesEntry(frame.head, entry));
						if (named.length) byName = named;
					}
					continue;
				}
				// A module's folder holding nothing suspended says nothing about which call is running.
				if (placement.byModule && !placement.matches.length) continue;
				if (syncEnded) awaiting.push({ frame, ...placement });
				else {
					running.push({ frame, ...placement });
					below = [];
				}
			}
			if (!syncEnded && truncated) return undefined;
			if (!running.length && !awaiting.length) return byName ? settle(byName) : truncated ? undefined : null;

			// With no placed frame of its own, the job is placed by the innermost flow awaiting it.
			if (!running.length) {
				if (!awaiting[0].matches.length) return AMBIGUOUS;
				return this.#narrow(awaiting, null, callKey, truncated);
			}
			// A suspended call that resumed runs its own function: the outermost frame is that function, in the call's
			// own file. Whatever it calls — another module's handler or a function another call returned — runs as
			// that call, as the async runtime attributes it.
			// Only a function with nothing but the microtask runner below it is resuming: one a boundary or another
			// module calls has their frames below it.
			const outermost = running[running.length - 1];
			if (outermost.byFile && below.every(isRunnerFrame)) {
				const resumed = outermost.matches.filter((entry) => runtime_namesEntry(outermost.frame.head, entry));
				if (resumed.length && new Set(resumed.map(callKey)).size === 1) return resumed[0];
			}
			// Otherwise every placed frame of the synchronous part is code taking part in this access — the job's own, and
			// the helpers it called or handed to a boundary — so all of them have to agree on the caller. Code no
			// suspended call accounts for refuses.
			let agreed = null;
			for (const { matches } of running) {
				agreed = agreed ? agreed.filter((entry) => matches.includes(entry)) : matches;
				if (!agreed.length) return AMBIGUOUS;
			}
			if (new Set(agreed.map(callKey)).size === 1) return agreed[0];
			// Different functions of one file: a frame in a candidate's own file names the function as well.
			for (const { frame, byFile } of running) {
				if (!byFile) continue;
				const pinned = agreed.filter((entry) => runtime_namesEntry(frame.head, entry));
				if (pinned.length && new Set(pinned.map(callKey)).size === 1) return pinned[0];
			}
			return this.#narrow(awaiting, agreed, callKey, truncated);
		};

		// The capture is paid on every identity read while a call is suspended, so it starts small: the frames
		// that decide sit near the top of the stack. Only a trace the budget cut short that settled nothing is
		// read again, deeper. The capture is kept out of a leaf's reach; see runtime_captureFrames.
		const answer = walk(runtime_captureFrames(25), false);
		return answer !== undefined ? answer : walk(runtime_captureFrames(50), true);
	}

	/**
	 * Settle a job's placement, narrowing it by the frames further out when it names several calls.
	 * @param {Array<{frame: object, matches: Array<object>, byFile: boolean}>} placed - Placed frames to narrow by,
	 *   innermost first.
	 * @param {Array<object>|null} narrowed - The calls the job is already narrowed to, or null.
	 * @param {function(object): string} callKey - What has to agree for enforcement.
	 * @param {boolean} truncated - Whether frames further out were cut off.
	 * @returns {object|symbol|undefined} The entry, AMBIGUOUS, or undefined when more frames could still settle it.
	 * @private
	 */
	#narrow(placed, narrowed, callKey, truncated) {
		for (const { frame, matches, byFile } of placed) {
			// Frames further out that are no suspended call's are flows awaiting this one: they cannot narrow.
			if (!matches.length) continue;
			let matched = narrowed ? matches.filter((entry) => narrowed.includes(entry)) : matches;
			if (!matched.length) return AMBIGUOUS;
			if (new Set(matched.map(callKey)).size === 1) return matched[0];
			// Different functions of one file: the frame names the function as well as the file. Only the text
			// before the location is searched, so a name inside the path cannot match by accident. Not tried for
			// a frame placed by module or import — the function there is the helper's, not the candidate's.
			if (byFile) {
				const pinned = matched.filter((entry) => runtime_namesEntry(frame.head, entry));
				if (pinned.length && new Set(pinned.map(callKey)).size === 1) return pinned[0];
			}
			narrowed = matched;
		}
		return truncated ? undefined : AMBIGUOUS;
	}

	/**
	 * Whether the currently-active flow belongs to the given instance — its base store, a
	 * `run()`/`scope()` child of it (`<id>__run_*`), or an instance whose `parentInstanceID` is it.
	 *
	 * Enforcement resolves a caller/store scoped to the instance doing the enforcing rather than to
	 * whichever instance happens to be globally active, so a nested instance's own boot is never
	 * enforced against an outer instance's ambient caller (#290). The manager is a singleton shared
	 * by every instance, so without this a leaf that boots a second `slothlet()` leaks its identity
	 * into the second instance's construction. Mirrors the child-context test in {@link LiveContextManager#runInContext}.
	 *
	 * @param {string|null} currentID - The globally-active instance id (`this.currentInstanceID`).
	 * @param {string} instanceID - The instance to test membership against.
	 * @returns {boolean} True when the active flow is that instance or a child scope of it.
	 * @private
	 */
	#flowBelongsToInstance(currentID, instanceID) {
		if (!currentID) return false;
		if (currentID === instanceID) return true;
		if (currentID.startsWith(instanceID + "__run_")) return true;
		return this.instances.get(currentID)?.parentInstanceID === instanceID;
	}

	/**
	 * Register the EventEmitter context checker
	 * Must be called AFTER EventEmitter patching is enabled
	 * @public
	 */
	registerEventEmitterContextChecker() {
		setApiContextChecker(() => {
			// The raw field: whether any instance is live is all this asks, and it is asked per emit.
			return this.#activeID !== null;
		});
		// The AsyncResource capture in the EventEmitter helper restores an AsyncLocalStorage context,
		// which this manager does not use — and in a browser AsyncResource does not exist at all. A
		// listener registered by a module therefore had no captured identity of its own; it worked only
		// because this manager's active-instance field outlives every call, so `self` resolved for
		// whatever happened to be running. Pinning the registering module here gives that propagation a
		// real implementation, and attributes the listener to the module rather than to the host.
		/**
		 * Pin several callbacks registered at the same moment (a `then`'s two reactions) to one resolution
		 * of who registered them, so the registration is read once, not once per callback.
		 * @param {Function[]} listeners - Callbacks being registered.
		 * @returns {Function[]} Each callback, pinned where there is a caller to pin it to.
		 */
		const pinMany = (listeners) => {
			// The store of the instance actually executing (#592), and who on it registered the callbacks.
			const store = this.tryGetContext();
			if (!store) return listeners;
			const { wrapper, inFlight, ambiguous } = this.#registrationIdentity(store);
			// Registered by the host with nothing in flight: nothing it could be mistaken for, so leave it
			// alone. Unattributable module code: not handed the host's standing either.
			if (ambiguous || (!wrapper && !inFlight)) return listeners;
			return listeners.map((listener) => (typeof listener === "function" ? pinListener(listener, store.instanceID, wrapper) : listener));
		};
		/**
		 * The pinned replacement for one callback.
		 * @param {Function} listener - The callback.
		 * @param {string} instanceID - Instance it was registered on.
		 * @param {object|null} wrapper - The module that registered it, or null for the host.
		 * @returns {Function} The pinned callback.
		 */
		const pinListener = (listener, instanceID, wrapper) =>
			function slothlet_pinnedEventListener(...args) {
				// The instance can be gone by the time a deferred callback runs: a listener registered
				// before shutdown, or a timer already scheduled, still fires afterwards. Re-entering a
				// context that no longer exists throws CONTEXT_NOT_FOUND, and from a listener or timer
				// there is nobody to catch it — it surfaces as an uncaught exception and takes the
				// process down. Run the callback unpinned instead: with no context its `self` refuses,
				// which is the same fail-closed answer any unattributed deferred work gets.
				if (!liveContextManagerRef.instances.has(instanceID)) return listener.apply(this, args);
				// rawErrors: a listener's own throw must reach its emitter unchanged. Without it
				// runInContext would re-wrap anything that is not a SlothletError as
				// CONTEXT_EXECUTION_FAILED, rewriting errors an `error` handler is meant to receive.
				// Same reason the pinned-hook and lockCaller call sites pass it.
				// A host registration made while calls were in flight runs as the host (#595): left unpinned
				// it would be attributed, when it runs, to whichever call is then the only one suspended.
				if (!wrapper) return liveContextManagerRef.runRegisteredAsHost(instanceID, listener, this, args);
				return liveContextManagerRef.runInContext(instanceID, listener, this, args, wrapper, true);
			};
		const pinOne = (listener) => pinMany([listener])[0];
		pinOne.many = pinMany;
		setApiCallerPinner(pinOne);
		liveContextManagerRef = this;
	}

	/**
	 * Push a host entry onto the entered stack of every store, so the host is the answer whichever
	 * instance the code running next calls into — not only the store the pin was taken against (#601).
	 *
	 * @returns {object[]} The stores pushed onto, for {@link LiveContextManager#leaveHost}.
	 * @private
	 */
	#enterHost() {
		const stores = [...this.instances.values()];
		for (const store of stores) this.#enteredFor(store).push(HOST_ENTRY);
		return stores;
	}

	/**
	 * Pop the host entries {@link LiveContextManager#enterHost} pushed. Entries are strictly nested —
	 * synchronous code pushes and pops in order — so each store's top entry is the one pushed there.
	 *
	 * @param {object[]} stores - The stores returned by `#enterHost`.
	 * @returns {void}
	 * @private
	 */
	#leaveHost(stores) {
		for (const store of stores) this.#enteredFor(store).pop();
	}

	/**
	 * Run a host-registered deferred callback as the host.
	 *
	 * The synchronous body runs with a host entry on every instance's stack, so any identity read inside
	 * it — on whichever instance it calls into — is the host's rather than whichever call happens to be
	 * suspended there. Unlike `runInContext(…, asHost)` the store's fields are left untouched: the host
	 * registered it, so there is no module identity to keep alive.
	 *
	 * A callback that returns a promise (an async callback) resumes between its own awaits with nothing
	 * entered. It needs nothing more: a suspended call is told apart from the stack, and code the stack
	 * attributes to none of them, such as the resumed callback, runs as the host.
	 *
	 * @param {string} instanceID - Instance the callback was registered against.
	 * @param {Function} fn - The callback.
	 * @param {*} thisArg - `this` for the callback.
	 * @param {Array} args - Arguments for the callback.
	 * @returns {*} The callback's return value; its own errors propagate unchanged.
	 * @public
	 */
	runRegisteredAsHost(instanceID, fn, thisArg, args) {
		// The instance shut down after the registration: nothing left to attribute to.
		if (!this.instances.has(instanceID)) return fn.apply(thisArg, args);
		const previousInstanceID = this.#activeID;
		this.#activeID = instanceID;
		const stores = this.#enterHost();
		this.#syncDepth++;
		let result;
		try {
			result = fn.apply(thisArg, args);
		} finally {
			this.#syncDepth--;
			this.#leaveHost(stores);
			this.#activeID = previousInstanceID;
		}
		return result;
	}

	/**
	 * Initialize context for a new instance
	 * @param {string} instanceID - Unique instance identifier
	 * @param {Object} config - Instance configuration
	 * @returns {Object} Created context store
	 * @public
	 */
	initialize(instanceID, config = {}) {
		if (this.instances.has(instanceID)) {
			throw new SlothletError("CONTEXT_ALREADY_EXISTS", { instanceID }, null, { validationError: true });
		}

		const store = {
			instanceID,
			self: {},
			context: {},
			config: { ...config },
			createdAt: Date.now()
		};

		this.instances.set(instanceID, store);

		// In live mode, automatically set as current if it's the first/only instance
		if (!this.#activeID) {
			this.#activeID = instanceID;
		}

		return store;
	}

	/**
	 * Run function with instance context active (live mode)
	 * @param {string} instanceID - Instance to run in context of
	 * @param {Function} fn - Function to execute
	 * @param {*} thisArg - this binding for function
	 * @param {Array} args - Arguments to pass to function
	 * @param {Object} [currentWrapper] - Current wrapper being executed (for metadata.self())
	 * @param {boolean} [rawErrors=false] - When `true`, let a non-SlothletError thrown by
	 *   `fn` propagate unchanged instead of wrapping it as `CONTEXT_EXECUTION_FAILED`. Used
	 *   for framework callbacks (`lockCaller`, pinned hooks) where the caller expects the
	 *   original error type/code/status.
	 * @param {boolean} [asHost=false] - When `true`, run `fn` with **no module caller**: both
	 *   `currentWrapper` and `callerWrapper` are cleared for the execution, so `fn` runs as the host
	 *   (`metadata.caller()` returns null inside it). `currentWrapper` is ignored. Used by
	 *   `lockCaller.caller()` when the pinned caller is the host.
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(instanceID, fn, thisArg, args, currentWrapper, rawErrors = false, asHost = false) {
		// CHILD INSTANCE APPROACH: Check if current is this instance OR a child of this instance
		const currentID = this.currentInstanceID;
		const isAlreadyInContext = this.#flowBelongsToInstance(currentID, instanceID);

		// If already in correct context (base or child), just use current
		const targetInstanceID = isAlreadyInContext ? currentID : instanceID;

		const store = this.instances.get(targetInstanceID);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", {
				instanceID: targetInstanceID,
				availableInstances: Array.from(this.instances.keys())
			});
		}

		// Pin the store's resting identity before anything below can change the field it is read from.
		this.#baselineFor(store);

		// Set current instance (synchronous). The raw field is saved and restored, never the resolved one.
		const previousInstanceID = this.#activeID;
		const previousWrapper = store.currentWrapper;
		const previousCallerWrapper = store.callerWrapper;

		// The caller of this call is whoever is executing at the moment it is entered — the identity
		// enforcement resolves, read before this call is pushed. Not `previousWrapper`: that is the
		// shared field, restored in settle order, so code that resumed after an overlapping call settled
		// out of order finds it naming a finished call, or none (#591). Only a call that names a module
		// records a caller; the restore below still puts back the saved field values.
		const entryCaller = currentWrapper && !asHost ? (this.#identityFor(store).currentWrapper ?? null) : null;

		this.#activeID = targetInstanceID;
		if (asHost) {
			// Pinned to "no module caller": the call runs as the host, not as whichever module is ambient.
			store.callerWrapper = null;
			store.currentWrapper = null;
		}
		// currentWrapper is optional; false branch is covered directly in context-live-branches tests
		// but v8 hit-counter overflows to -255 in the parallel matrix, appearing uncovered.
		/* v8 ignore next */
		if (currentWrapper) {
			store.callerWrapper = entryCaller;
			store.currentWrapper = currentWrapper;
		}

		// Restore previous state. Idempotent: the sync and settle paths must never both apply it,
		// or a nested call's saved state would be restored twice.
		let restored = false;
		const restore = () => {
			// Idempotence guard. The sync and settle paths are mutually exclusive by construction, so the
			// second call this protects against does not occur — but restoring twice would roll a nested
			// call's saved state back over the live one, which is worth guarding regardless.
			/* v8 ignore next */
			if (restored) return;
			restored = true;
			this.#activeID = previousInstanceID;
			store.currentWrapper = previousWrapper;
			store.callerWrapper = previousCallerWrapper;
		};

		// Mark this call as executing synchronously for exactly as long as `fn` is on the stack — for an
		// async function, up to its first `await`. Pushed unconditionally (a wrapper-less entry pushes
		// null, which the resolver skips) so the pop below always removes what was pushed here.
		//
		// A call pinned to the host is the host on every instance it calls into, not only this one's store
		// (#601), the same as a host-registered callback (see runRegisteredAsHost).
		const entered = this.#enteredFor(store);
		const hostStores = asHost ? this.#enterHost() : null;
		if (!hostStores) entered.push(currentWrapper ?? null);
		// An identity published as authoritative (the lazy waiting-proxy path) speaks for the target's
		// apply trap, up to the moment the target is entered here. Once a call that names a module (or
		// the host) is on the stack, that call is what is executing — so it is withdrawn for the body and
		// put back afterwards, or a leaf the body enters would be attributed to the publisher's caller.
		const previousAuthoritative = store.__authoritativeWrapper;
		const withdrawAuthoritative = Boolean(previousAuthoritative) && Boolean(currentWrapper || asHost);
		if (withdrawAuthoritative) store.__authoritativeWrapper = null;

		try {
			let result;
			this.#syncDepth++;
			try {
				result = fn.apply(thisArg, args);
			} finally {
				this.#syncDepth--;
				if (hostStores) this.#leaveHost(hostStores);
				else entered.pop();
				if (withdrawAuthoritative) store.__authoritativeWrapper = previousAuthoritative;
			}
			// An async module function returns at its first `await`, long before its body is done.
			// Restoring here would drop the caller identity for the rest of that body — and an absent
			// caller reads as host-initiated, so every permission-gated read or call after an `await`
			// would be allowed outright regardless of policy. Awaiting is mandatory for lazy access,
			// so that is the normal path, not an edge case. Hold the identity until the call settles,
			// and record the call as suspended so an overlapping sibling can be told apart from it.
			//
			// Native promises only. A lazy wrapper's waiting proxy is also thenable, but it is a
			// pending *value*, not the call's completion — adopting it here would consume the
			// thenable and hand back a plain promise in its place. Those reads carry their own
			// caller snapshot taken when the proxy was created, so they stay attributed anyway.
			if (util.types.isPromise(result)) {
				// A host-pinned call (`asHost`) has no wrapper, so it is tracked with an empty api path and
				// no filePath (see #resolveSuspendedFromStack).
				/* v8 ignore next — a live wrapper always carries filePath/apiPath; the ?? on a present wrapper guards a partial mock. */
				const apiPath = currentWrapper?.____slothletInternal?.apiPath ?? "";
				/* v8 ignore next */
				const filePath = currentWrapper?.____slothletInternal?.filePath ?? null;
				const entry = {
					// The store the call runs on and the instance it belongs to, so the calls of every
					// instance can be told apart when resolving which one is executing.
					store,
					family: store.parentInstanceID ?? store.instanceID,
					currentWrapper,
					// Who called it, as resolved at entry; reported for it while it is suspended.
					callerWrapper: asHost ? null : entryCaller,
					filePath,
					// The same file as a stack frame spells it, compared by the resolver (relative to the
					// manifest root in browser mode).
					comparablePath: toComparablePath(filePath),
					// The file's real path when a symlink makes it differ, as a Node stack frame names it.
					realComparablePath: runtime_realComparablePath(filePath),
					// The URL this mount's copy of the file was imported from, which need not end in its path (a
					// browser resolver's `blob:` / `data:` URL, a TypeScript leaf's compiled copy).
					locations: runtime_importedLocations(currentWrapper, filePath),
					// Owning module, so a frame in any file of that module can be attributed to this call.
					/* v8 ignore next */
					moduleID: currentWrapper?.____slothletInternal?.moduleID ?? null,
					apiPath,
					// Leaf segment of the api path — the function name as it appears in a stack frame,
					// used to tell two functions of the same module apart.
					fnName: apiPath.slice(apiPath.lastIndexOf(".") + 1),
					// The names the entered function goes by on a stack: its api key, and its own name when that
					// differs (`handler = async function doWork() {}`).
					fnNames: runtime_entryNames(apiPath, currentWrapper)
				};
				// Only a call with a module caller is tracked as suspended — a host-initiated call has no
				// identity to disambiguate later, so there is nothing to record. Every promise-returning call
				// reaching here carries the wrapper being invoked, so the skip arm guards a caller-less entry
				// this path is not handed.
				//
				// A call pinned to the host (`asHost`) is the exception: it deliberately holds the shared
				// field at null for its whole async lifetime. Were it untracked, a single suspended module
				// call resuming meanwhile would trust that null field and be treated as the host — failing
				// open. Tracking it keeps the count honest, so that module is resolved from its stack instead.
				/* v8 ignore next */
				if (currentWrapper || asHost) {
					this.#suspendedFor(store).add(entry);
					this.#busyStores.add(store);
				}
				const settle = () => {
					const suspended = this.#suspendedFor(store);
					suspended.delete(entry);
					if (suspended.size === 0) this.#busyStores.delete(store);
					restore();
				};
				// Unpinned: settling restores the shared fields, which a pinned reaction would put back.
				try {
					return nativeThen(
						result,
						(value) => {
							settle();
							return value;
						},
						(error) => {
							settle();
							throw error;
						}
					);
					// Not a promise after all: an object only tagged "Promise", which the browser's tag check
					// cannot tell apart. It is returned as the value it is, as before (see platform.mjs). Node's
					// util.types.isPromise is a brand check, so only the browser host can reach this.
					/* v8 ignore start */
				} catch {
					settle();
					return result;
				}
				/* v8 ignore stop */
			}
			restore();
			return result;
		} catch (error) {
			restore();
			// Rethrow framework errors directly so they propagate with their original code.
			// rawErrors also opts out non-SlothletError throws so framework callbacks keep
			// their original error type/code/status.
			if (rawErrors || error instanceof SlothletError) throw error;
			throw new SlothletError(
				"CONTEXT_EXECUTION_FAILED",
				{
					instanceID
				},
				error
			);
		}
	}

	/**
	 * Capture the caller identity of the executing flow so it can be re-entered later.
	 *
	 * Used by around hooks: a pinned around handler runs as the module that registered it, but the
	 * rest of the pipeline its `next()` runs belongs to the intercepted call, whose target must see
	 * that call's own caller.
	 *
	 * @param {string} instanceID - Instance whose flow to capture.
	 * @returns {{instanceID: string|null, store: object, currentWrapper: object|null, callerWrapper: object|null, unresolved: boolean}|null}
	 *   Snapshot for {@link LiveContextManager#runInFlow}, or null when the instance has no store.
	 * @public
	 */
	captureFlow(instanceID) {
		const store = this.tryGetContext(instanceID);
		/* v8 ignore next — a live instance always has a store while its api is callable; guards a torn-down instance. */
		if (!store) return null;
		// The identity resolved for the executing call, not the store's shared fields: those are restored
		// in settle order, so once calls overlap they can name a call that has already finished (#591).
		const identity = this.#identityFor(store);
		return {
			instanceID: this.currentInstanceID,
			store,
			currentWrapper: identity.currentWrapper,
			callerWrapper: identity.callerWrapper,
			unresolved: identity.unresolved === true
		};
	}

	/**
	 * Run a callback with a flow captured by {@link LiveContextManager#captureFlow} active, then put
	 * back whatever was active before. Only the synchronous portion runs under the captured identity;
	 * a call started inside it holds its own identity until it settles, as every live call does.
	 *
	 * @param {{instanceID: string|null, store: object, currentWrapper: object|null, callerWrapper: object|null, unresolved?: boolean}} flow - Captured flow.
	 * @param {function(): *} fn - Callback to run.
	 * @returns {*} The callback's return value.
	 * @public
	 */
	runInFlow(flow, fn) {
		const { store } = flow;
		const previousInstanceID = this.#activeID;
		const previousWrapper = store.currentWrapper;
		const previousCallerWrapper = store.callerWrapper;
		this.#activeID = flow.instanceID;
		store.currentWrapper = flow.currentWrapper;
		store.callerWrapper = flow.callerWrapper;
		// The captured flow is what is executing for the synchronous part: entered on the stack so the
		// identity resolver answers with it — the module it names, or the host — rather than with the
		// call that invoked this (a pinned around handler, which has its own entry further down). An
		// identity that was unresolved at capture stays a looked-through entry, never the host's.
		const entered = this.#enteredFor(store);
		entered.push(flow.unresolved ? null : (flow.currentWrapper ?? HOST_ENTRY));
		this.#syncDepth++;
		try {
			return fn();
		} finally {
			this.#syncDepth--;
			entered.pop();
			this.#activeID = previousInstanceID;
			store.currentWrapper = previousWrapper;
			store.callerWrapper = previousCallerWrapper;
		}
	}

	/**
	 * Get current active context
	 * @returns {Object} Current context store
	 * @throws {SlothletError} If no active context
	 * @public
	 */
	getContext() {
		const activeID = this.currentInstanceID;
		if (!activeID) {
			throw new SlothletError("NO_ACTIVE_CONTEXT_LIVE", {}, null, { validationError: true });
		}

		const store = this.instances.get(activeID);
		if (!store) {
			throw new SlothletError(
				"CONTEXT_NOT_FOUND",
				{
					instanceID: activeID,
					availableInstances: Array.from(this.instances.keys()).join(", ") || "none"
				},
				null,
				{ validationError: true }
			);
		}

		return store;
	}

	/**
	 * Try to get context (returns undefined instead of throwing)
	 *
	 * @param {string} [instanceID] - When provided, resolve the store scoped to this instance rather
	 *   than to the globally-active one. If the active flow belongs to this instance (base or a
	 *   `run()`/`scope()` child) its store is returned; otherwise the instance has no active flow and
	 *   its own base store is returned, so host-level checks (e.g. the `TRUSTED_ROOT` read-gate
	 *   exemption) evaluate against the right instance instead of an unrelated ambient caller (#290).
	 *   Omit for the legacy "globally-active store" behavior.
	 * @returns {Object|undefined} Current context store or undefined
	 * @public
	 */
	tryGetContext(instanceID) {
		const activeID = this.currentInstanceID;
		if (instanceID === undefined) {
			if (!activeID) {
				return undefined;
			}
			return this.instances.get(activeID);
		}
		if (this.#flowBelongsToInstance(activeID, instanceID)) {
			return this.instances.get(activeID);
		}
		return this.instances.get(instanceID);
	}

	/**
	 * Capture the parts of this instance's executing flow that a later, out-of-band run must
	 * reproduce: the user context (`context.run()`'s), the caller identity, the owner-locked context
	 * keys and whether the flow is host-trusted. Used by the event system (#497) so a deferred
	 * delivery runs exactly as an immediate one would have. Holds references only — nothing is cloned
	 * or serialized.
	 *
	 * @param {string} instanceID - Instance whose flow to capture.
	 * @returns {object|null} An opaque flow snapshot for {@link runInSnapshotFlow}, or null when the
	 *   instance has no context store.
	 * @public
	 */
	snapshotFlow(instanceID) {
		const store = this.tryGetContext(instanceID);
		if (!store) return null;
		const identity = this.getCallerIdentity(instanceID);
		return {
			context: store.context,
			currentWrapper: identity.currentWrapper ?? null,
			callerWrapper: identity.callerWrapper ?? null,
			contextOwners: store.__contextOwners ?? null,
			trusted: store[TRUSTED_ROOT] === true
		};
	}

	/**
	 * Run `fn` inside a flow rebuilt from a {@link snapshotFlow} snapshot, on top of the instance's
	 * CURRENT base store (so a snapshot taken before a reload runs against the reloaded instance).
	 * The replayed store is made the active instance for the duration of `fn` — including its async
	 * tail — exactly as `run()`/`scope()` do in the live runtime. The deliverer's own ambient context
	 * is not merged in: the snapshot's context replaces it.
	 *
	 * @param {string} instanceID - Instance to run against.
	 * @param {object} captured - Snapshot from {@link snapshotFlow}.
	 * @param {Function} fn - Function to run (may be async).
	 * @returns {Promise<*>} Resolves/rejects with `fn`'s outcome.
	 * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no base store.
	 * @public
	 */
	async runInSnapshotFlow(instanceID, captured, fn) {
		const childStore = buildCapturedFlowStore(this.instances, instanceID, captured);
		this.instances.set(childStore.instanceID, childStore);
		const previousInstanceID = this.#activeID;
		try {
			this.#activeID = childStore.instanceID;
			return await fn();
		} finally {
			this.#activeID = previousInstanceID;
			this.instances.delete(childStore.instanceID);
		}
	}

	/**
	 * Cleanup instance context
	 * @param {string} instanceID - Instance to cleanup
	 * @public
	 */
	cleanup(instanceID) {
		const store = this.instances.get(instanceID);
		if (!store) {
			throw new SlothletError(
				"CONTEXT_NOT_FOUND",
				{ instanceID, availableInstances: Array.from(this.instances.keys()).join(", ") || "none" },
				null,
				{ validationError: true }
			);
		}

		// Clear the store data
		store.self = {};
		store.context = {};

		// Remove from instances map
		this.instances.delete(instanceID);
		// A call still suspended when its instance shut down never settles here: its store would otherwise
		// stay among the busy ones for the life of the process, and every later identity read would pay a
		// stack read for it (#601 review). Its run()/scope() stores go with it.
		for (const busy of this.#busyStores) {
			if (busy === store || busy.parentInstanceID === instanceID) this.#busyStores.delete(busy);
		}

		// Clear current instance if it was this one
		if (this.#activeID === instanceID) {
			this.#activeID = null;
		}
	}

	/**
	 * Get diagnostic information
	 * @returns {Object} Diagnostic data
	 * @public
	 */
	getDiagnostics() {
		return {
			type: "live",
			currentInstanceID: this.currentInstanceID,
			instances: Array.from(this.instances.entries()).map(([id, store]) => ({
				id,
				createdAt: store.createdAt,
				contextKeys: Object.keys(store.context),
				selfKeys: Object.keys(store.self)
			}))
		};
	}
}

/**
 * Singleton live context manager
 * @public
 */
export const liveContextManager = new LiveContextManager();
