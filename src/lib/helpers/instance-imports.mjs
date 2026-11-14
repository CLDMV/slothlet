/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/instance-imports.mjs
 *	@Date: 2026-09-28T20:32:55-07:00 (1790652775)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:58:04-08:00 (1794185884)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Carry a leaf's per-instance import query onto the relative helpers it imports (#518).
 * @module @cldmv/slothlet/helpers/instance-imports
 *
 * @description
 * The loader imports every leaf with a per-instance query
 * (`?slothlet_instance=<id>[&module=<moduleID>][&_reload=<timestamp>]`), so each instance — and each
 * reload — evaluates its own copy of the leaf. A module the leaf IMPORTS is resolved by the host,
 * which knows nothing about that query: a relative helper would be one module shared by every
 * instance and every reload, and module-level state in it would leak between instances.
 *
 * This module closes that gap for everything reachable through relative or `file:` specifiers, and
 * through bare ones (`#imports`, a self-reference) that resolve into the importer's own package
 * (#715), at any depth:
 *
 * - **Native Node** — {@link installInstanceImportHooks} registers a process-wide, in-thread resolve
 *   hook (`module.registerHooks()`, Node >= 22.15 — slothlet's engines floor) that copies the
 *   importing module's instance parameter onto the child. Registered once per process; a no-op
 *   for every import whose parent carries no slothlet query.
 * - **Vite / vitest** — {@link slothletInstanceImports} is the same rule as a vite `resolveId`
 *   plugin, for leaves loaded through a consumer's `import` hook into a vite module graph (where
 *   Node's resolve hooks never run).
 *
 * A helper is ONE copy per instance. Only `slothlet_instance` is copied: not the leaf's `module`
 * (mount) parameter, so the base leaves and every `api.slothlet.api.add` mount share the copy; and
 * not the leaf's `_reload` stamp, so a partial reload (`api.slothlet.api.reload(…)`) re-imports the
 * reloaded leaves against the instance's existing helper copy — helper state survives it. A full
 * reload (`api.slothlet.reload()`) rotates the instance ID, which is what gives helpers a fresh
 * copy; edits to helper code therefore need a full reload.
 *
 * What stays shared: bare specifiers into another package (`node_modules` packages, `node:` builtins,
 * `@cldmv/slothlet` and its runtime), any file in a package other than the importer's own however
 * the import is spelled (a `node_modules` package, or a workspace package linked in from outside
 * `node_modules`: one file, one URL, #715), and slothlet's own source files — the live-binding
 * runtime must remain one module per process.
 *
 * Crossing module systems (#534). Node caches CommonJS by file path, so a query on a CommonJS URL is
 * ignored, and `require(esm)` loads an ES module under its plain file URL. Two more hooks close that:
 *
 * - **ESM → CommonJS** — a `load` hook turns an instance-marked CommonJS URL into a small ES module
 *   wrapper that runs the file through the instance's private CommonJS cache
 *   ({@link requireInInstance}, the same cache a `.cjs` leaf's own requires use). Its export names come
 *   from a static scan of the source (see `cjs-export-names.mjs`), as Node's own are.
 * - **CommonJS → ESM** — while {@link requireInInstance} runs its synchronous require, the scope is
 *   active: a `require()` from a file of that scope resolving to an ES module of the instance's graph (by a
 *   relative path, or by `#imports` or a self-reference into its own package, #715) is marked, and
 *   the `load` hook answers it with a CommonJS stub that returns the ES module imported under the
 *   instance query — the same module record an ESM leaf of the instance imports.
 */

import { commonJSExportNames } from "./cjs-export-names.mjs";
import {
	Objects,
	Arrays,
	JSON,
	Map,
	Set,
	WeakMap,
	Symbol,
	Symbols,
	URL,
	URLSearchParams,
	Reflect
} from "@cldmv/slothlet/helpers/intrinsics";

/**
 * Query parameters copied from a leaf onto its helpers: the instance only. The leaf's `module`
 * (mount) and `_reload` (partial-reload stamp) parameters are deliberately NOT copied — a helper is
 * one copy per instance, shared by every mount and kept across partial reloads; a full reload
 * rotates the instance ID and so yields a fresh copy.
 * @type {ReadonlyArray<string>}
 * @internal
 */
export const INSTANCE_QUERY_KEYS = Objects.freeze(["slothlet_instance"]);

/**
 * Query parameter a leaf's URL carries when its instance loads helper files once per importing api file (the
 * `helpers: "module"` option), and its value. A helper loaded for such a leaf carries it too, with
 * {@link HELPERS_FOR_PARAM} naming the api file it was loaded for and {@link HELPERS_MOUNT_PARAM} that file's mount,
 * so each api file gets its own copy of every helper it imports, and a copy's stack frames name the file it runs for.
 * @type {string}
 * @internal
 */
export const HELPERS_PARAM = "slothlet_helpers";

/**
 * The value of {@link HELPERS_PARAM}.
 * @type {string}
 * @internal
 */
export const HELPERS_PER_MODULE = "module";

/**
 * Query parameter of a helper copy: the path of the api file it was loaded for (see {@link HELPERS_PARAM}).
 * @type {string}
 * @internal
 */
export const HELPERS_FOR_PARAM = "slothlet_for";

/**
 * Query parameter of a helper copy: the mount (`module` parameter) of the api file it was loaded for.
 * @type {string}
 * @internal
 */
export const HELPERS_MOUNT_PARAM = "slothlet_mount";

/**
 * The marker a parent's URL/id must carry for its imports to be rewritten.
 * @type {string}
 * @private
 */
const MARKER = "slothlet_instance=";

/**
 * Flag marking the hooks as registered on a registry a caller passed to {@link installInstanceImportHooks}.
 * @type {symbol}
 * @private
 */
const INSTALLED = Symbols.for("@cldmv/slothlet.instanceImports.hooks");

/**
 * Query parameter marking a URL that a `require()` resolved inside an active instance scope (#534).
 * @type {string}
 * @private
 */
const REQUIRE_PARAM = "slothlet_require";

/**
 * Query parameter marking a URL that a `require()` made by an instance's ES module resolved (`createRequire`, #755):
 * the load hook answers it with a CommonJS stub that returns the instance's copy of the file and does not stay in
 * Node's require cache.
 * @type {string}
 * @private
 */
const MODULE_REQUIRE_PARAM = "slothlet_module_require";

/**
 * Virtual-module prefix: `slothlet-esm:<url>` is an ES module whose `"module.exports"` export is the
 * namespace of `<url>`, so a synchronous `require()` of it returns that namespace (#534).
 * @type {string}
 * @private
 */
const ESM_PREFIX = "slothlet-esm:";

/**
 * Virtual-module prefix: `slothlet-esm-facade:<url>` re-exports `<url>` plus `__esModule: true`, the
 * shape Node's `require(esm)` returns for an ES module with a default export (#534).
 * @type {string}
 * @private
 */
const FACADE_PREFIX = "slothlet-esm-facade:";

/**
 * Virtual-module prefix: `slothlet-shared-require:<url>` is the CommonJS stub that answers a `require()` an instance's
 * code makes of a file no instance tags (see {@link sharedRequireStub}): it hands back the file's one module of the
 * process and leaves Node's require cache, so Node asks the resolve hook again at the next such `require()`.
 * @type {string}
 * @private
 */
const SHARED_REQUIRE_PREFIX = "slothlet-shared-require:";

/**
 * The file a stub {@link sharedRequireStub} gave is requiring from slothlet's own file while it runs (see
 * {@link requireShared}), or null. That `require()` is slothlet's, made on the requiring api file's behalf, so the
 * resolve hook neither records slothlet's file as loading it nor answers it with a stub.
 * @type {string|null}
 * @private
 */
let SERVING = null;

/**
 * Global key of the object the slothlet copies of a process share (#534): the entry points of the code slothlet
 * generates, and what a second copy of slothlet needs from the first (see {@link sharedState}). A copy older than
 * this one keeps its own state under another key, and shares nothing with this one.
 * @type {symbol}
 * @private
 */
const STATE = Symbols.for("@cldmv/slothlet.instanceImports");

/**
 * The expression the code slothlet generates reaches the shared object by.
 * @type {string}
 * @private
 */
const STATE_REF = `globalThis[Symbol.for(${JSON.stringify(STATE.description)})]`;

/**
 * Per instance ID: the private CommonJS module copies of that instance, by filename (#534). Kept here, with the
 * collections below, out of every module's reach: which CommonJS files are an instance's code is read from them.
 * @type {Map<string, Map<string, object>>}
 * @private
 */
const SCOPES = new Map();

/**
 * Per instance ID and importing api file (with its mount): that file's private CommonJS module copies
 * (`helpers: "module"`).
 * @type {Map<string, Map<string, Map<string, object>>>}
 * @private
 */
const COPIES = new Map();

/**
 * Per instance ID: the CommonJS leaves it loaded, which its private cache does not keep (each load evaluates the leaf
 * anew).
 * @type {Map<string, Set<string>>}
 * @private
 */
const LEAVES = new Map();

/**
 * Per instance ID with any CommonJS file: an object standing for the instance's CommonJS state, which a reader keys
 * what it derived from the files on (see {@link instanceCommonJSVersion}). It holds nothing.
 * @type {Map<string, object>}
 * @private
 */
const SCOPE_KEYS = new Map();

/**
 * The scope a synchronous {@link scopeRequire} is running in (`anchor` is the file it required; `importer` the api
 * file whose own copies are served, under `helpers: "module"`), else null.
 * @type {{ instanceID: string, anchor: string, importer?: string|null, mount?: string|null }|null}
 * @private
 */
let ACTIVE = null;

/**
 * The instance IDs claimed (see {@link claimInstanceScope}), each with the handle its claimer holds.
 * @type {Map<string, object>}
 * @private
 */
const CLAIMS = new Map();

/**
 * The handles this copy of slothlet claimed for the callers of {@link requireInInstance} that hold none of their own.
 * @type {Map<string, object>}
 * @private
 */
const UNHELD = new Map();

/**
 * What each ticket the load hook wrote into generated code stands for (see {@link mintTicket}): the instance and
 * the one thing the code may do.
 * @type {Map<string, {instanceID: string, job: Function}>}
 * @private
 */
const TICKETS = new Map();

/**
 * How a URL is reduced to the key its script hashes are kept under, once frame placement has registered it (see
 * {@link setScriptKey}).
 * @type {?function(string): string}
 * @private
 */
let SCRIPT_KEY_OF = null;

/**
 * Frame placement's check of who is calling into slothlet (see {@link setCallerCheck}).
 * @type {?function(Error): ?string}
 * @private
 */
let CALLER_CHECK = null;

/**
 * Whether this copy's hooks are registered with Node.
 * @type {boolean}
 * @private
 */
let HOOKED = false;

/**
 * The sources this copy's load hook recorded (see {@link recordLoadedSource}), by script key, the newest
 * {@link SCRIPTS_PER_KEY} each (#597). Kept here, out of every module's reach: other slothlet copies read them through
 * the frozen reader on the shared object (see {@link SCRIPTS_READER}).
 * @type {Map<string, Array<string>>}
 * @private
 */
const LOADED_SCRIPTS = new Map();

/**
 * The text of each source in {@link LOADED_SCRIPTS}, by script key and then by hash: the exact text the engine
 * compiled (TypeScript with its types stripped), which is what a frame's line and column are positions in and what a
 * function's own text is a piece of. Frame placement reads where each leaf's function sits from it, so a file changed
 * on disk after it was loaded changes nothing. Kept and dropped with the hashes.
 * @type {Map<string, Map<string, string>>}
 * @private
 */
const LOADED_TEXTS = new Map();

/**
 * Who loaded each file no instance tags, as this copy's resolve hook saw it resolved (#597): by the file's path (forward
 * slashes, no query, the real path Node resolves to), the URLs of the files that import it — a module's instance copy
 * with its tags, a package file, the host's own — and, when the named importer is a file nothing loaded through the
 * hook, of the module's instance copy whose code was running when the file was resolved (a `require` it made through
 * `createRequire` of any path). Kept here, out of every
 * module's reach, and read through the frozen reader on the shared object (see {@link SCRIPTS_READER}): whose code
 * an untagged file's code is, under `permissions.provenance`. A file loaded before slothlet's hook was registered has
 * no entry: it is the host's.
 * @type {Map<string, Set<string>>}
 * @private
 */
const PACKAGE_IMPORTERS = new Map();

/**
 * A module's instance copy in a stack line: its `file:` URL with the instance query, up to the line number.
 * @type {RegExp}
 * @private
 */
const TAGGED_FRAME = /(file:\/\/[^\s()?]+\?[^\s():]*slothlet_instance=[^\s():]+)/;

/**
 * `Error` as it was when slothlet loaded, so a stack is captured the same way whatever a host or module did to it.
 * @type {ErrorConstructor}
 * @private
 */
const PristineError = Error;

/**
 * The innermost module instance copy on the stack (see {@link TAGGED_FRAME}), read from the whole stack in V8's own
 * format: Node's loader frames between a module's `require()` and the resolve hook can run past a host's
 * `Error.stackTraceLimit` (Node 22's CommonJS loader puts more than ten there).
 * @returns {string|undefined} The module's copy, or undefined when none is on the stack.
 * @private
 */
function runningTaggedFrame() {
	const previousLimit = PristineError.stackTraceLimit;
	const previousPrepare = PristineError.prepareStackTrace;
	PristineError.stackTraceLimit = Infinity;
	PristineError.prepareStackTrace = undefined;
	try {
		return TAGGED_FRAME.exec(String(new PristineError().stack))?.[1];
	} finally {
		PristineError.stackTraceLimit = previousLimit;
		PristineError.prepareStackTrace = previousPrepare;
	}
}

/**
 * An untagged file's key in {@link PACKAGE_IMPORTERS}: its path with forward slashes and no query, a Windows drive
 * spelled as a stack frame spells it.
 * @param {string} url - The file's URL or path.
 * @returns {string} The key.
 * @private
 */
function packageKey(url) {
	return toSlashPath(url).replace(/^\/([a-z]:\/)/i, "$1");
}

/**
 * Record who loaded a file no instance tags, when the resolve hook resolved one (see {@link PACKAGE_IMPORTERS}): the
 * file that imports it, and the instance copy of a module whose code is on the stack while it resolves.
 * @param {string|undefined} parentURL - The importing file's URL.
 * @param {string|undefined} url - What it resolved to.
 * @returns {void}
 * @private
 */
function recordPackageImport(parentURL, url) {
	if (typeof url !== "string" || !url.startsWith("file:") || url.includes(MARKER)) return;
	const loaders = [];
	const parent = typeof parentURL === "string" && parentURL.startsWith("file:") ? parentURL : null;
	if (parent) loaders.push(parent);
	// Named as imported by a file nothing loaded through the hook (`createRequire` of any path, a host file loaded
	// before it): the module whose code is running loaded it. A module's own import, or one of a file the hook saw
	// loaded, keeps to its importer, so a module that merely triggers another's lazy load takes none of its files.
	if (!parent || (!parent.includes(MARKER) && !PACKAGE_IMPORTERS.has(packageKey(parent)))) {
		const running = runningTaggedFrame();
		if (running) loaders.push(running);
	}
	if (!loaders.length) return;
	const key = packageKey(url);
	let importers = PACKAGE_IMPORTERS.get(key);
	if (!importers) PACKAGE_IMPORTERS.set(key, (importers = new Set()));
	for (const loader of loaders) importers.add(loader);
}

/**
 * A frame of a module's instance copy in a stack line, whichever loader evaluated it: its URL or path carries the
 * instance query (a `file:` URL under Node's loader, a path under vite's module runner).
 * @type {RegExp}
 * @private
 */
const INSTANCE_FRAME = /\?[^\s():]*slothlet_instance=/;

/**
 * Whether the resolution the resolve hook is answering is a `require()` loading the file, made by an instance's code:
 * Node's CommonJS loader (`Module._load`) is reached on the stack before the `require` function Node hands each module
 * (a `require.resolve()` reaches that function first), and the `require` is made from an instance copy's URL or while
 * such a copy's code runs.
 * @param {string} parentURL - The requiring file's URL.
 * @returns {boolean} True for such a `require()`.
 * @private
 */
function isInstanceRequireLoad(parentURL) {
	const previousLimit = PristineError.stackTraceLimit;
	const previousPrepare = PristineError.prepareStackTrace;
	PristineError.stackTraceLimit = Infinity;
	PristineError.prepareStackTrace = undefined;
	let stack;
	try {
		stack = String(new PristineError().stack);
	} finally {
		PristineError.stackTraceLimit = previousLimit;
		PristineError.prepareStackTrace = previousPrepare;
	}
	const lines = stack.split("\n");
	let at = -1;
	for (let i = 0; i < lines.length && at === -1; i++) {
		if (lines[i].includes("(node:internal/modules/helpers:")) return false;
		if (/^\s*at Module\._load \(node:/.test(lines[i])) at = i;
	}
	if (at === -1) return false;
	return parentURL.includes(MARKER) || lines.slice(at + 1).some((line) => INSTANCE_FRAME.test(line));
}

/**
 * The resolution a `require()` an instance's code makes of a file no instance tags is answered with (see
 * {@link SHARED_REQUIRE_PREFIX}), or null when the resolution stands as it is. Node keeps such a file once for the
 * process, and answers a later `require()` of it by the same specifier from the same folder from its own caches,
 * without asking the resolve hook: the api file making it would go unrecorded among the files loading it (see
 * {@link PACKAGE_IMPORTERS}), and the file's own code would not be told apart as that api file's. This happens for a
 * `require` an api file makes from its own path (`createRequire(fileURLToPath(import.meta.url))`) as for one it makes
 * from its URL, whichever file of the folder required it first, and in every instance after the first. The stub
 * answering the `require()` hands back the one module of the file and takes itself out of Node's caches, so each such
 * `require()` reaches the hook and is recorded. A `require.resolve()` still answers the file's path, and a `require()`
 * slothlet's own files make, or one made while a CommonJS api file loads (recorded from Node's own list, see
 * {@link recordScopeRequires}), is left as it is.
 * Only a `require()` whose importer is an instance copy, or one the resolve hook has seen nothing load (the path a
 * `require` was made from), is looked at.
 * @param {object} context - Node's resolve context.
 * @param {ResolveResult} resolved - The resolution.
 * @returns {ResolveResult|null} The stub's resolution, or null.
 * @private
 */
function sharedRequireStub(context, resolved) {
	const url = resolved?.url;
	const parentURL = context?.parentURL;
	if (ACTIVE !== null || typeof url !== "string" || !url.startsWith("file:") || url.includes("?") || /\.(?:json|node)$/.test(url))
		return null;
	if (typeof parentURL !== "string" || !parentURL.startsWith("file:") || !hasCondition(context?.conditions, "require")) return null;
	const own = (ref) => {
		const path = toSlashPath(ref);
		return OWN_TREE.some((dir) => path === dir || path.startsWith(dir.endsWith("/") ? dir : `${dir}/`));
	};
	if (own(parentURL) || own(url)) return null;
	if (!parentURL.includes(MARKER) && PACKAGE_IMPORTERS.has(packageKey(parentURL))) return null;
	if (!isInstanceRequireLoad(parentURL)) return null;
	return { url: SHARED_REQUIRE_PREFIX + url, format: "commonjs", shortCircuit: true };
}

/**
 * Answer a `require()` through the stub {@link sharedRequireStub} gives: the file's one module of the process, as
 * Node's own `require()` of it gives, required from slothlet's own file. The stub's entry is taken out of Node's
 * require cache first, so the next `require()` of the file by that specifier asks the resolve hook again.
 * @param {string} url - The file's URL.
 * @param {object} stub - The stub's own `module`.
 * @returns {*} The value `require()` returns.
 * @private
 */
function requireShared(url, stub) {
	const requireFn = nodeBuiltin("node:module").createRequire(import.meta.url);
	const cache = requireFn.cache;
	for (const key of [stub?.id, stub?.filename]) if (typeof key === "string" && cache[key] === stub) delete cache[key];
	const outer = SERVING;
	SERVING = url;
	try {
		return requireFn(nodeBuiltin("node:url").fileURLToPath(url));
	} finally {
		SERVING = outer;
	}
}

/**
 * The reader of {@link LOADED_SCRIPTS} on the shared object: whether a key has sources recorded and whether a given
 * one is among them, a copy of them, how many keys have any, and the files importing a package file (see
 * {@link PACKAGE_IMPORTERS}). Nothing it offers adds or drops a source or an import, so a module reaching the shared
 * object cannot have code it compiled under another file's name taken for that file (#597). Only the copy that
 * recorded them drops an instance's, when it shuts down.
 * @type {{lookup: Function, hashes: Function, text: Function, count: Function, packageImporters: Function}}
 * @private
 */
const SCRIPTS_READER = Objects.freeze({
	lookup: (key, hash) => {
		const hashes = LOADED_SCRIPTS.get(key);
		return { known: Boolean(hashes?.length), has: hash !== undefined && Boolean(hashes?.includes(hash)) };
	},
	hashes: (key) => [...(LOADED_SCRIPTS.get(key) ?? [])],
	text: (key, hash) => {
		const texts = LOADED_TEXTS.get(key);
		if (!texts) return undefined;
		if (hash !== undefined && hash !== null) return texts.get(hash);
		// No hash to go by (an engine that reports none): the newest source loaded under the key.
		const newest = LOADED_SCRIPTS.get(key)?.at(-1);
		return newest === undefined ? undefined : texts.get(newest);
	},
	count: () => LOADED_SCRIPTS.size,
	packageImporters: (path) => [...(PACKAGE_IMPORTERS.get(packageKey(path)) ?? [])]
});

/**
 * The object the slothlet copies of a process share, made and kept by the first copy to load. It is frozen, and holds
 * no collection and no record: what slothlet keeps about an instance's files stays in module-private state of the
 * copy that made the object, and every member here either reads from that state without handing any of it out, only
 * ever adds to it what a module may add, or acts for one instance on proof of being that instance.
 * @typedef {object} InstanceImportState
 * @property {(instanceID: string, parent: string, children: string[]) => void} recordImports - Records a module's
 *   imports; called by the registration the vite plugin appends to each instance module. It only ever adds an importer.
 * @property {{of: function(string): (object|null)}} imports - The reader of the import graphs (see graphView).
 * @property {{lookup: Function, hashes: Function, text: Function, count: Function, packageImporters: Function}} scripts -
 *   The reader of the sources the load hook recorded (#597).
 * @property {{files: function(string): string[], version: function(string): ({key: object, count: number}|null)}} commonJS -
 *   The reader of an instance's CommonJS files.
 * @property {(url: string) => string} scriptKeyOf - How a URL is reduced to its script key.
 * @property {(url: string) => (object|undefined)} own - The namespace of one of slothlet's runtime entry files the
 *   keeping copy has evaluated (#760, see registerOwnModule).
 * @property {(instanceID: string) => (object|null)} claim - Claims an instance ID (see claimInstanceScope).
 * @property {() => boolean} hooks - Registers the keeping copy's hooks with Node, once.
 * @property {(ticket: string) => object} redeem - Entry point of the code the load hook generates (see mintTicket).
 * @property {(specifier: *, importer: string) => *} checkImport - Holds an import or `import.meta.resolve` an instance
 *   module vite loaded makes by a specifier only known as it runs (see checkModuleImport).
 * @property {(filePath: string, instanceID: string) => *} requireCJS - Entry point of the wrapper the vite plugin
 *   generates for a CommonJS helper (see requireCJSFromRunner).
 * @internal
 */

/**
 * The import graphs this copy recorded, per instance ID: for each file of an instance's import graph, the files that
 * import it (forward-slash paths). Kept here, out of every module's reach: whose code a helper file's code is follows
 * from it, so nothing a module can get hold of may add to it other than a further importer, and nothing may drop or
 * replace one. Other slothlet copies record into it and read it through the shared object.
 * @type {Map<string, Map<string, Set<string>>>}
 * @private
 */
const IMPORT_GRAPHS = new Map();

/**
 * The read-only view of each instance's graph (see {@link graphView}), made on first read and dropped with the graph.
 * @type {Map<string, object>}
 * @private
 */
const GRAPH_VIEWS = new Map();

/**
 * Record, in this copy's graphs, that one file of an instance imports others. The `recordImports` of the shared
 * object: the registration the vite plugin appends to each instance module calls it, as does every slothlet copy's
 * resolve hook. It only ever adds an importer.
 * @param {string} instanceID - The instance.
 * @param {string} parent - The importing file's URL or path.
 * @param {string[]} children - The imported files' URLs or paths.
 * @returns {void}
 * @private
 */
function recordImportsHere(instanceID, parent, children) {
	if (typeof instanceID !== "string" || typeof parent !== "string" || !Arrays.isArray(children)) return;
	let graph = IMPORT_GRAPHS.get(instanceID);
	if (!graph) {
		graph = new Map();
		IMPORT_GRAPHS.set(instanceID, graph);
	}
	const parentPath = toSlashPath(parent);
	for (const child of children) {
		if (typeof child !== "string") continue;
		const childPath = toSlashPath(child);
		let parents = graph.get(childPath);
		if (!parents) {
			parents = new Set();
			graph.set(childPath, parents);
		}
		const before = parents.size;
		parents.add(parentPath);
		// Counted on the graph, so a reader can tell it changed without walking it.
		if (parents.size !== before) graph.edges = (graph.edges ?? 0) + 1;
	}
}

/**
 * A read-only view of one instance's import graph: what a `Map` of importers by imported file offers a reader, with
 * every collection of importers handed out as a copy. One object per instance for as long as the graph lives, so a
 * reader can key what it derived from the graph on it, and `edges` says whether the graph has grown since.
 * @param {Map<string, Set<string>>} graph - The graph.
 * @returns {object} The view.
 * @private
 */
function graphView(graph) {
	return Objects.freeze({
		get edges() {
			return graph.edges ?? 0;
		},
		get size() {
			return graph.size;
		},
		has: (file) => graph.has(file),
		get: (file) => {
			const importers = graph.get(file);
			return importers ? new Set(importers) : undefined;
		},
		keys: () => [...graph.keys()].values(),
		*[Symbol.iterator]() {
			for (const [file, importers] of graph) yield [file, [...importers]];
		}
	});
}

/**
 * The reader of {@link IMPORT_GRAPHS} on the shared object: the read-only view of an instance's graph.
 * @type {{of: function(string): (object|null)}}
 * @private
 */
const IMPORTS_READER = Objects.freeze({
	of: (instanceID) => {
		const graph = IMPORT_GRAPHS.get(instanceID);
		if (!graph) return null;
		let view = GRAPH_VIEWS.get(instanceID);
		if (!view) GRAPH_VIEWS.set(instanceID, (view = graphView(graph)));
		return view;
	}
});

/**
 * The reader of an instance's CommonJS files on the shared object (see {@link instanceCommonJSFiles} and
 * {@link instanceCommonJSVersion}): a copy of the list, and a count beside an object that holds nothing.
 * @type {{files: function(string): string[], version: function(string): ({key: object, count: number}|null)}}
 * @private
 */
const COMMONJS_READER = Objects.freeze({
	files: (instanceID) => {
		const scope = SCOPES.get(instanceID);
		const files = [...(scope ? scope.keys() : []), ...(LEAVES.get(instanceID) ?? [])];
		// The copies kept per importing api file (`helpers: "module"`).
		for (const copies of COPIES.get(instanceID)?.values() ?? []) files.push(...copies.keys());
		return files;
	},
	version: (instanceID) => {
		const key = SCOPE_KEYS.get(instanceID);
		if (!key) return null;
		let count = (SCOPES.get(instanceID)?.size ?? 0) + (LEAVES.get(instanceID)?.size ?? 0);
		for (const held of COPIES.get(instanceID)?.values() ?? []) count += held.size;
		return { key, count };
	}
});

/**
 * The shared object this copy made, when it was the first copy of the process to need one.
 * @type {InstanceImportState|null}
 * @private
 */
let OWN_STATE = null;

/**
 * The shared object, once found or made: it is fixed on the global object, so it is read from there once.
 * @type {InstanceImportState|null}
 * @private
 */
let SHARED = null;

/**
 * The object the slothlet copies of the process share, made on first use by the first copy to get here: fixed on the
 * global object and frozen, so no code can put another in its place or change a member of it.
 * @returns {InstanceImportState} The shared object.
 * @private
 */
function sharedState() {
	if (SHARED !== null) return SHARED;
	const held = globalThis[STATE];
	if (held !== undefined) return (SHARED = held);
	OWN_STATE = Objects.freeze({
		recordImports: recordImportsHere,
		imports: IMPORTS_READER,
		scripts: SCRIPTS_READER,
		commonJS: COMMONJS_READER,
		scriptKeyOf: (url) => (SCRIPT_KEY_OF ? SCRIPT_KEY_OF(url) : url),
		own: (url) => OWN_MODULES.get(url),
		claim: claimHere,
		hooks: () => installInstanceImportHooks(NODE_MODULE),
		redeem: redeemTicket,
		requireCJS: requireCJSFromRunner,
		checkImport: checkModuleImport
	});
	Objects.defineProperty(globalThis, STATE, { value: OWN_STATE, enumerable: false, configurable: false, writable: false });
	return (SHARED = OWN_STATE);
}

/**
 * Whether this copy of slothlet made the shared object, and so keeps what every copy's instances record.
 * @returns {boolean} True for the keeping copy.
 * @private
 */
function isKeeper() {
	return sharedState() === OWN_STATE;
}

/**
 * A Node builtin, read through `process.getBuiltinModule()` so this module has no static `node:`
 * import (it is also loaded by browser bundles and by vite configs).
 * @param {string} id - The builtin's id (`"node:module"`, …).
 * @returns {object} The builtin module.
 * @private
 */
function nodeBuiltin(id) {
	return globalThis.process.getBuiltinModule(id);
}

/**
 * The builtins and functions package detection reads files with, captured when this module loads (#715). The resolve
 * hook runs in the importing thread, so reading `process.getBuiltinModule`, `fs.readFileSync` or `JSON.parse` at
 * resolve time would let code that replaced one change which files an instance shares. Null where no Node builtins
 * are available (a browser bundle).
 * @type {{randomUUID: Function, sha256: Function, decode: Function, readFile: Function, exists: Function, dirname: Function, join: Function, basename: Function, compileFunction: Function, parseJSON: Function}|null}
 * @private
 */
const HOST = (() => {
	const getBuiltinModule = globalThis.process?.getBuiltinModule;
	if (typeof getBuiltinModule !== "function") return null;
	const fs = getBuiltinModule("node:fs");
	const path = getBuiltinModule("node:path");
	const vm = getBuiltinModule("node:vm");
	const crypto = getBuiltinModule("node:crypto");
	const createHash = crypto.createHash;
	const hashPrototype = Objects.getPrototypeOf(Reflect.apply(createHash, crypto, ["sha256"]));
	const update = hashPrototype.update;
	const digest = hashPrototype.digest;
	const Decoder = globalThis.TextDecoder;
	const decode = Decoder.prototype.decode;
	return Objects.freeze({
		randomUUID: crypto.randomUUID.bind(crypto),
		// What a loaded script is recorded under (see recordLoadedSource): the hash and the decoding are the ones in place
		// when slothlet loaded, as frame placement's are, so replacing `crypto` or `TextDecoder` later changes neither.
		sha256: (text) => {
			const hash = Reflect.apply(createHash, crypto, ["sha256"]);
			Reflect.apply(update, hash, [text, "utf8"]);
			return Reflect.apply(digest, hash, ["hex"]);
		},
		decode: (bytes) => Reflect.apply(decode, new Decoder(), [bytes]),
		readFile: fs.readFileSync.bind(fs),
		exists: fs.existsSync.bind(fs),
		dirname: path.dirname.bind(path),
		join: path.join.bind(path),
		basename: path.basename.bind(path),
		compileFunction: vm.compileFunction.bind(vm),
		parseJSON: JSON.parse
	});
})();

/**
 * `node:module` as it was when this module loaded, for the hooks another slothlet copy asks this one to register.
 * Null where no Node builtins are available.
 * @type {object|null}
 * @private
 */
const NODE_MODULE = typeof globalThis.process?.getBuiltinModule === "function" ? globalThis.process.getBuiltinModule("node:module") : null;

/**
 * Slothlet's own files, as forward-slash paths: the `lib/` tree (`src/lib/` or `dist/lib/`) and the
 * package's two entry files. Imports resolving here are never duplicated per instance.
 * @type {string[]}
 * @private
 */
const OWN_PREFIXES = [
	new URL("../", import.meta.url),
	new URL("../../../index.mjs", import.meta.url),
	new URL("../../../index.cjs", import.meta.url)
]
	.filter((u) => u.protocol === "file:")
	.map((u) => toSlashPath(u.href));

/**
 * Slothlet's runtime entry files, as `file:` URLs: the modules an api file imports `self`, `context` and `instanceID`
 * from. Each is one module per process whichever loader is asked for it (#760).
 * @type {string[]}
 * @private
 */
const SINGLE_COPY_FILES = [
	new URL("../runtime/runtime.mjs", import.meta.url),
	new URL("../runtime/runtime-asynclocalstorage.mjs", import.meta.url),
	new URL("../runtime/runtime-livebindings.mjs", import.meta.url)
]
	.filter((u) => u.protocol === "file:")
	.map((u) => u.href);

/**
 * The namespace of each of {@link SINGLE_COPY_FILES} this copy of slothlet has evaluated, by its URL (#760).
 * @type {Map<string, object>}
 * @private
 */
const OWN_MODULES = new Map();

/**
 * Those of {@link SINGLE_COPY_FILES} Node itself loaded before this copy had evaluated them: this copy's own, loaded
 * by Node. Node then has the very module this copy runs on, and nothing is answered in its place.
 * @type {Set<string>}
 * @private
 */
const NODE_LOADED = new Set();

/**
 * The instance IDs claimed through this copy's own {@link claimInstanceScope}: the instances of the slothlet this
 * copy of the module belongs to, as opposed to those another copy claimed through the shared object.
 * @type {Set<string>}
 * @private
 */
const OWN_CLAIMS = new Set();

/**
 * Virtual-module prefix: `slothlet-own:<url>` is an ES module that re-exports the namespace this copy evaluated for
 * one of {@link SINGLE_COPY_FILES} (see {@link ownModuleBridge}).
 * @type {string}
 * @private
 */
const OWN_MODULE_PREFIX = "slothlet-own:";

/**
 * Record that one of slothlet's runtime entry files has been evaluated, with its namespace (#760). Called by each of
 * those files as its last statement. A process can run two module loaders at once: under vitest, slothlet's source is
 * evaluated by vite's module runner, while a CommonJS file, or a file imported by its URL, is loaded by Node itself.
 * Asked for the runtime by such a file, Node would evaluate the runtime's file a second time, and that second copy
 * knows no instance. With the namespace recorded here, the resolve hook sends Node's import of the file to a module
 * that re-exports the namespace already made (see {@link ownModuleBridge}), so the importer gets the runtime slothlet
 * runs on. A second copy of slothlet that Node loaded itself keeps Node's own evaluation of the file, which is that
 * copy's runtime (see {@link isOtherCopysFile}). Only the runtime's entry files are taken, each once.
 * @param {string} url - The file's `import.meta.url`.
 * @param {object} namespace - Its module namespace.
 * @returns {void}
 * @internal
 * @example
 * registerOwnModule(import.meta.url, runtimeNamespace);
 */
export function registerOwnModule(url, namespace) {
	if (!SINGLE_COPY_FILES.includes(url) || OWN_MODULES.has(url)) return;
	OWN_MODULES.set(url, namespace);
}

/**
 * The source of the module Node is given for one of slothlet's runtime entry files this copy has already evaluated
 * through another loader (#760): it exports what that namespace exports, read once from the shared object. The
 * runtime's exports are constants, so nothing is lost by reading them once.
 * @param {string} url - The file's URL.
 * @returns {string} The module's source.
 * @private
 */
function ownModuleBridge(url) {
	const lines = [`const ns = ${STATE_REF}.own(${JSON.stringify(url)});`];
	let n = 0;
	// The runtime's entry files export by name only.
	for (const name of Objects.keys(OWN_MODULES.get(url))) {
		lines.push(`const n${n} = ns[${JSON.stringify(name)}];`, `export { n${n} as ${JSON.stringify(name)} };`);
		n++;
	}
	return lines.join("\n") + "\n";
}

/**
 * The instances a file Node loaded belongs to, for {@link isOtherCopysFile}: the one its URL names; else those whose
 * CommonJS files hold its path; else those of the files recorded as loading it, a few steps up.
 * @param {string} url - The file's URL.
 * @returns {Set<string>} The instance IDs.
 * @private
 */
function instancesOfFile(url) {
	const found = new Set();
	const seen = new Set();
	const queue = [url];
	while (queue.length && seen.size < 64) {
		const next = queue.shift();
		if (typeof next !== "string" || seen.has(next)) continue;
		seen.add(next);
		const tagged = new URLSearchParams(splitQuery(next)[1] ?? "").get("slothlet_instance");
		if (tagged) {
			found.add(tagged);
			continue;
		}
		const path = packageKey(next);
		let held = false;
		for (const instanceID of SCOPE_KEYS.keys()) {
			if (COMMONJS_READER.files(instanceID).some((file) => packageKey(file) === path)) {
				found.add(instanceID);
				held = true;
			}
		}
		if (!held) queue.push(...(PACKAGE_IMPORTERS.get(path) ?? []));
	}
	return found;
}

/**
 * Whether a file Node loaded, which imports one of slothlet's runtime entry files, belongs to another copy of
 * slothlet than this one (#760): one of slothlet's own files (a second copy of slothlet, loaded by Node while this one
 * runs in another loader), or a file of an instance such a copy claimed and none of this copy's did. Its runtime is
 * that copy's: Node's own evaluation of the file. Every other importer (a file of this copy's instances, the host's) is
 * given the runtime this copy runs on.
 * @param {string|undefined} parentURL - The importing file's URL.
 * @returns {boolean} True when the importer is another copy's.
 * @private
 */
function isOtherCopysFile(parentURL) {
	if (typeof parentURL !== "string") return false;
	const path = toSlashPath(parentURL);
	if (OWN_TREE.some((own) => path === own || path.startsWith(own.endsWith("/") ? own : `${own}/`))) return true;
	let other = false;
	for (const instanceID of instancesOfFile(parentURL)) {
		if (OWN_CLAIMS.has(instanceID)) return false;
		if (CLAIMS.has(instanceID)) other = true;
	}
	return other;
}

/**
 * Whether a specifier names a file relative to (or absolute from) its importer, as opposed to a
 * bare package/builtin/subpath-import specifier.
 * @param {string} specifier - The import/require specifier as written.
 * @returns {boolean} True for `./`, `../`, `/` and `file:` specifiers.
 * @internal
 * @example
 * isFileSpecifier("../lib/state.mjs"); // true
 * isFileSpecifier("@cldmv/slothlet/runtime"); // false
 */
export function isFileSpecifier(specifier) {
	return (
		typeof specifier === "string" &&
		(specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/") || specifier.startsWith("file:"))
	);
}

/**
 * Normalize a `file:` URL, filesystem path or vite id to a forward-slash path without query/hash.
 * @param {string} ref - A `file:` URL, an absolute path (either separator), or a vite id.
 * @returns {string} The forward-slash path.
 * @private
 */
function toSlashPath(ref) {
	let p = ref;
	const cut = p.search(/[?#]/);
	if (cut !== -1) p = p.slice(0, cut);
	if (p.startsWith("file:")) {
		p = decodeURIComponent(p.replace(/^file:\/\/[^/]*/, ""));
	}
	return p.replace(/\\/g, "/");
}

/**
 * The path an api file is named by on the helper copies loaded for it (see {@link HELPERS_FOR_PARAM}): its
 * forward-slash path, a Windows drive path without the slash a `file:` URL puts before it, so the file's URL and its
 * filesystem path name it alike.
 * @param {string} ref - A `file:` URL, an absolute path (either separator), or a vite id.
 * @returns {string} The path.
 * @private
 */
function helperImporterPath(ref) {
	const path = toSlashPath(ref);
	return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
}

/**
 * The key an api file's own CommonJS copies are kept under (`helpers: "module"`): the file, and its mount when it has
 * one, so one file mounted twice keeps two sets.
 * @param {string} importer - The api file, as {@link helperImporterPath} names it.
 * @param {string|null} mount - Its mount.
 * @returns {string} The key.
 * @private
 */
function helperCopyKey(importer, mount) {
	return mount ? `${importer}\u0000${mount}` : importer;
}

/**
 * The `node_modules` package directory a path lives in (`…/node_modules/pkg` or
 * `…/node_modules/@scope/pkg`), or null when the path is outside every `node_modules`.
 * @param {string} slashPath - A forward-slash path.
 * @returns {string|null} The package directory, or null.
 * @private
 */
function nodeModulesPackage(slashPath) {
	const idx = slashPath.lastIndexOf("/node_modules/");
	if (idx === -1) return null;
	const rest = slashPath.slice(idx + "/node_modules/".length).split("/");
	const depth = rest[0]?.startsWith("@") ? 2 : 1;
	return slashPath.slice(0, idx) + "/node_modules/" + rest.slice(0, depth).join("/");
}

/**
 * The package each directory outside `node_modules` belongs to, as {@link packageRoot} found it: the directory of the
 * nearest named `package.json` at or above it, or null when there is none. Cached for the life of the process.
 * @type {Map<string, string|null>}
 * @private
 */
const PACKAGE_ROOTS = new Map();

/**
 * Whether a directory holds a `package.json` with a `name`: a package's root. A `package.json` without one (a
 * `{"type": "module"}` marker in a subfolder) only sets the module system of its folder and stays in the package above.
 * @param {object} host - The captured builtins ({@link HOST}).
 * @param {string} dir - A forward-slash directory path, without a trailing slash ("" for the filesystem root).
 * @returns {boolean} True when the directory is a package's root.
 * @private
 */
function isPackageRoot(host, dir) {
	try {
		const { name } = host.parseJSON(host.readFile(`${dir}/package.json`, "utf8"));
		return typeof name === "string" && name !== "";
	} catch {
		return false;
	}
}

/**
 * The package a file belongs to (#715): its `node_modules` package directory, or, for a file outside every
 * `node_modules`, the directory of the nearest named `package.json` at or above it (a workspace package linked into
 * `node_modules` resolves to its real path outside it). Null when the file is in no package, or where no filesystem is
 * available to look.
 * @param {string} slashPath - The file's forward-slash path.
 * @returns {string|null} The package's directory, or null.
 * @private
 */
function packageRoot(slashPath) {
	const installed = nodeModulesPackage(slashPath);
	if (installed !== null) return installed;
	if (HOST === null) return null;
	// A Windows drive is read as the drive itself (`C:/…`), not as `/C:/…`.
	const filePath = slashPath.replace(/^\/([a-z]:\/)/i, "$1");
	const walked = [];
	let root = null;
	for (let dir = filePath.slice(0, filePath.lastIndexOf("/")); ; dir = dir.slice(0, dir.lastIndexOf("/"))) {
		if (PACKAGE_ROOTS.has(dir)) {
			root = PACKAGE_ROOTS.get(dir);
			break;
		}
		walked.push(dir);
		if (isPackageRoot(HOST, dir)) {
			root = dir;
			break;
		}
		if (!dir.includes("/")) break;
	}
	for (const dir of walked) PACKAGE_ROOTS.set(dir, root);
	return root;
}

/**
 * Whether a module resolved at `child` (imported from `parent`) belongs to the importing leaf's
 * per-instance graph. Slothlet's own files are always shared. A file in a package other than the
 * importer's own stays shared, however the import is spelled (#715): reached by a relative path or a
 * `file:` URL it is the same module as its package-name spelling, which is shared — one file, one URL
 * within an instance. A package is a `node_modules` package directory or, outside `node_modules`, the
 * nearest named `package.json` (a pnpm workspace package resolves to its real path there). A slothlet
 * plugin installed as a dependency, or a module that is a package of its own, keeps its own helpers per
 * instance.
 * @param {string} child - Resolved child (`file:` URL, path or vite id).
 * @param {string} parent - The importer (`file:` URL, path or vite id).
 * @returns {boolean} True when the child should carry the parent's instance query.
 * @internal
 * @example
 * isInstanceScopedFile("/app/lib/state.mjs", "/app/api/tally.mjs"); // true
 * isInstanceScopedFile("/app/node_modules/x/index.js", "/app/api/tally.mjs"); // false
 */
export function isInstanceScopedFile(child, parent) {
	const childPath = toSlashPath(child);
	if (OWN_PREFIXES.some((own) => childPath === own || (own.endsWith("/") && childPath.startsWith(own)))) return false;
	const childPkg = nodeModulesPackage(childPath);
	const parentPath = toSlashPath(parent);
	// Neither under `node_modules` and in one directory: the same package, without reading the filesystem.
	if (
		childPkg === null &&
		nodeModulesPackage(parentPath) === null &&
		childPath.slice(0, childPath.lastIndexOf("/")) === parentPath.slice(0, parentPath.lastIndexOf("/"))
	)
		return true;
	return packageRoot(childPath) === packageRoot(parentPath);
}

/**
 * Whether a file a bare specifier resolved to (`#imports`, or a package's reference to itself by name) is in the
 * importing module's own package, and so belongs to its per-instance graph as a relative import of the file does
 * (#715): one file is one URL inside an instance, however the import is spelled. A bare specifier that resolves into
 * another package stays shared, and slothlet's own source or build tree always does.
 * @param {string} child - Resolved child (`file:` URL, path or vite id).
 * @param {string} parent - The importer (`file:` URL, path or vite id).
 * @returns {boolean} True when the child should carry the parent's instance query.
 * @internal
 * @example
 * isOwnPackageImport("/app/lib/state.mjs", "/app/api/tally.mjs"); // true when `/app/package.json` is the package of both
 * isOwnPackageImport("/app/node_modules/x/index.js", "/app/api/tally.mjs"); // false
 */
export function isOwnPackageImport(child, parent) {
	const childPath = toSlashPath(child);
	if (OWN_TREE.some((own) => childPath === own || childPath.startsWith(own.endsWith("/") ? own : `${own}/`))) return false;
	return packageRoot(childPath) === packageRoot(toSlashPath(parent));
}

/**
 * The name of each package {@link packageRoot} found, by its directory. Cached for the life of the process.
 * @type {Map<string, string|null>}
 * @private
 */
const PACKAGE_NAMES = new Map();

/**
 * Whether a bare specifier can name a file of the importer's own package (#715): a subpath `#import`, or the package's
 * own name (a self-reference). Lets the vite plugin leave every other bare specifier to vite without resolving it.
 * @param {string} specifier - The specifier as written.
 * @param {string} importer - The importer (`file:` URL, path or vite id).
 * @returns {boolean} True when it can.
 * @private
 */
function mayNameOwnPackage(specifier, importer) {
	if (specifier.startsWith("#")) return true;
	const root = packageRoot(toSlashPath(importer));
	if (root === null) return false;
	const name = packageName(root);
	return name !== null && (specifier === name || specifier.startsWith(`${name}/`));
}

/**
 * The name a package's `package.json` gives it (see {@link PACKAGE_NAMES}), or null when it gives none.
 * @param {string} root - The package's directory, as {@link packageRoot} found it.
 * @returns {string|null} The name.
 * @private
 */
function packageName(root) {
	if (!PACKAGE_NAMES.has(root)) {
		let name = null;
		try {
			name = HOST.parseJSON(HOST.readFile(`${root}/package.json`, "utf8")).name ?? null;
		} catch {
			// A package `packageRoot` found under `node_modules` with no readable manifest has no name to refer to itself by.
		}
		PACKAGE_NAMES.set(root, typeof name === "string" ? name : null);
	}
	return PACKAGE_NAMES.get(root);
}

/**
 * The folders of a slothlet package that hold its code: its source and its build.
 * @type {string[]}
 * @private
 */
const CODE_DIRS = ["src/", "dist/"];

/**
 * The files of slothlet's code a module's files may import, by their path inside a code folder: the runtime's entry
 * files (`@cldmv/slothlet/runtime`, `/runtime/async`, `/runtime/live`). The package's entry files (`@cldmv/slothlet`)
 * are outside its code folders.
 * @type {string[]}
 * @private
 */
const MODULE_IMPORTABLE = ["lib/runtime/runtime.mjs", "lib/runtime/runtime-asynclocalstorage.mjs", "lib/runtime/runtime-livebindings.mjs"];

/**
 * The specifiers a module's files may import slothlet by, for the refusal's message.
 * @type {string}
 * @private
 */
const MODULE_IMPORTABLE_SPECIFIERS =
	"'@cldmv/slothlet', '@cldmv/slothlet/runtime', '@cldmv/slothlet/runtime/async', '@cldmv/slothlet/runtime/live'";

/**
 * The entry files of a slothlet package, at its root.
 * @type {string[]}
 * @private
 */
const ENTRY_FILES = ["index.mjs", "index.cjs"];

/**
 * Where a file is in slothlet's code, as a forward-slash path inside the package (`src/lib/…`, `dist/lib/…`,
 * `index.mjs`), or null for a file that is no slothlet package's code. Every copy of slothlet in the process counts,
 * however it is installed: a package named `@cldmv/slothlet`, its `src/` or `dist/` folder and its entry files.
 * @param {string} ref - The file's URL, path or vite id.
 * @returns {string|null} Its path inside the package, or null.
 * @private
 */
function slothletCodePath(ref) {
	if (typeof ref !== "string" || HOST === null) return null;
	const path = toSlashPath(ref);
	if (!path.includes("/src/") && !path.includes("/dist/") && !ENTRY_FILES.some((entry) => path.endsWith(`/${entry}`))) return null;
	const root = packageRoot(path);
	if (root === null || packageName(root) !== "@cldmv/slothlet") return null;
	const inside = (path.startsWith(`${root}/`) ? path : path.replace(/^\/([a-z]:\/)/i, "$1")).slice(root.length + 1);
	return CODE_DIRS.some((dir) => inside.startsWith(dir)) || ENTRY_FILES.includes(inside) ? inside : null;
}

/**
 * Whether a file is one of slothlet's own files a module's files may not import: any file of slothlet's code but the
 * runtime's entry files (see {@link MODULE_IMPORTABLE}).
 * @param {string} ref - The file's URL, path or vite id.
 * @returns {boolean} True when only slothlet's own files may import it.
 * @internal
 * @example
 * isSlothletInternal("file:///app/node_modules/@cldmv/slothlet/dist/lib/helpers/config.mjs"); // true
 * isSlothletInternal("file:///app/node_modules/@cldmv/slothlet/dist/lib/runtime/runtime.mjs"); // false
 */
export function isSlothletInternal(ref) {
	const inside = slothletCodePath(ref);
	if (inside === null || ENTRY_FILES.includes(inside)) return false;
	const dir = CODE_DIRS.find((code) => inside.startsWith(code));
	return !MODULE_IMPORTABLE.includes(inside.slice(dir.length));
}

/**
 * The paths of the api files slothlet has loaded (see {@link noteModuleFile}), by {@link packageKey}.
 * @type {Set<string>}
 * @private
 */
const MODULE_FILES = new Set();

/**
 * Record that slothlet loads an api file: its path, so the file's own code is told to be a module's wherever it runs
 * under its path alone (a loader evaluating the copy under another name, a `require` made from the file's plain path).
 * @param {string} ref - The api file's path or URL.
 * @returns {void}
 * @internal
 */
export function noteModuleFile(ref) {
	if (typeof ref === "string" && ref !== "") MODULE_FILES.add(packageKey(ref));
}

/**
 * Whether a file, of no instance's tag, is code of an instance's module: a CommonJS file of an instance (an api file,
 * or a helper the instance's CommonJS cache holds), one required while a CommonJS api file of the instance loads, or a
 * file of a module's own package (outside `node_modules`) that an instance's file loaded, directly or through other
 * such files (a helper required through a `require` made from a plain path, see {@link PACKAGE_IMPORTERS}). A file of
 * another package stays the host's, and so does any file of slothlet's own.
 * @param {string} ref - The file's URL or path.
 * @returns {boolean} True when it is a module's code.
 * @private
 */
function isUntaggedModuleFile(ref) {
	if (typeof ref !== "string" || ref.includes(MARKER) || slothletCodePath(ref) !== null) return false;
	const key = packageKey(ref);
	if (MODULE_FILES.has(key)) return true;
	if (ACTIVE !== null && (key === packageKey(ACTIVE.anchor) || isInstanceScopedFile(key, ACTIVE.anchor))) return true;
	for (const instanceID of SCOPE_KEYS.keys()) if (COMMONJS_READER.files(instanceID).some((file) => packageKey(file) === key)) return true;
	if (/\/node_modules\//.test(key)) return false;
	const seen = new Set([key]);
	const queue = [key];
	while (queue.length && seen.size < 64) {
		for (const loader of PACKAGE_IMPORTERS.get(queue.shift()) ?? []) {
			if (loader.includes(MARKER) || MODULE_FILES.has(packageKey(loader))) {
				if (isInstanceScopedFile(key, splitQuery(loader)[0])) return true;
				continue;
			}
			const through = packageKey(loader);
			if (!seen.has(through) && !/\/node_modules\//.test(through)) {
				seen.add(through);
				queue.push(through);
			}
		}
	}
	return false;
}

/**
 * The location a stack line names: the file, URL or vite id of the frame, without its line and column, or null for a
 * line naming none (`<anonymous>`, an `eval` frame).
 * @param {string} line - One line of a stack.
 * @returns {string|null} The location.
 * @private
 */
function frameLocation(line) {
	const match = /\(([^()]+):\d+:\d+\)\s*$/.exec(line) ?? /^\s*at (?:async )?([^\s()]+):\d+:\d+\s*$/.exec(line);
	return match ? match[1] : null;
}

/**
 * Whether the code that made the `require()` or `require.resolve()` the resolve hook is answering is a module's: the
 * first frame below Node's own and slothlet's own frames is an instance's copy, or a file of a module's that no
 * instance tags (see {@link isUntaggedModuleFile}). A `require` can be made from any path (`createRequire`), so the
 * importer Node names says nothing about who is requiring.
 * @returns {boolean} True when a module's code made it.
 * @private
 */
function isModuleRequire() {
	const previousLimit = PristineError.stackTraceLimit;
	const previousPrepare = PristineError.prepareStackTrace;
	PristineError.stackTraceLimit = 64;
	PristineError.prepareStackTrace = undefined;
	let stack;
	try {
		stack = String(new PristineError().stack);
	} finally {
		PristineError.stackTraceLimit = previousLimit;
		PristineError.prepareStackTrace = previousPrepare;
	}
	const lines = stack.split("\n").slice(1);
	let i = 0;
	// The resolve hook's own frames, then Node's loader.
	while (i < lines.length && slothletCodePath(frameLocation(lines[i]) ?? "") !== null) i++;
	while (i < lines.length && (frameLocation(lines[i]) ?? "node:").startsWith("node:")) i++;
	const caller = i < lines.length ? frameLocation(lines[i]) : null;
	if (caller === null || slothletCodePath(caller) !== null) return false;
	return INSTANCE_FRAME.test(caller) || isUntaggedModuleFile(caller);
}

/**
 * Whether an import or require resolving to one of slothlet's own files is a module's (see {@link refuseInternalImport}):
 * the importer is an instance's copy, a file of a module's that no instance tags, or a module whose URL an instance's
 * file imported (a `data:` URL); or the code making a `require()` is a module's, whatever importer it names.
 * Slothlet's own files import slothlet's files.
 * @param {string|undefined} parentURL - The importer Node names.
 * @param {string[]|undefined} conditions - The resolution's conditions.
 * @returns {boolean} True when it is a module's import.
 * @private
 */
function isModuleImport(parentURL, conditions) {
	if (typeof parentURL === "string") {
		if (parentURL.includes(MARKER)) return true;
		if (
			slothletCodePath(parentURL) === null &&
			(parentURL.startsWith("file:") ? isUntaggedModuleFile(parentURL) : MODULE_URLS.has(parentURL))
		)
			return true;
	}
	return hasCondition(conditions, "require") && isModuleRequire();
}

/**
 * The URLs other than files (`data:` modules) that an instance's file imported, so what such a module imports is
 * held as the importing file's own imports are.
 * @type {Set<string>}
 * @private
 */
const MODULE_URLS = new Set();

/**
 * The refusal {@link refuseInternalImport} throws, as slothlet builds it once loaded (see {@link setImportRefusal}).
 * @type {?function(object): Error}
 * @private
 */
let IMPORT_REFUSAL = null;

/**
 * Register how a refused import is reported: a function given `{ specifier, file, allowed }` that returns the error to
 * throw. Taken once, by the copy that keeps the shared object.
 * @param {function(object): Error} make - Builds the error.
 * @returns {void}
 * @internal
 */
export function setImportRefusal(make) {
	if (isKeeper() && IMPORT_REFUSAL === null && typeof make === "function") IMPORT_REFUSAL = make;
}

/**
 * The error for a module's import of one of slothlet's own files.
 * @param {string} specifier - The specifier as written.
 * @param {string} file - The file it resolved to.
 * @returns {Error} The error.
 * @private
 */
function importRefusal(specifier, file) {
	const details = { specifier, file: toSlashPath(file), allowed: MODULE_IMPORTABLE_SPECIFIERS };
	if (IMPORT_REFUSAL !== null) return IMPORT_REFUSAL(details);
	// Slothlet registers its error before any module loads; a host using the hooks on their own gets the bare code.
	const error = new PristineError(`MODULE_INTERNAL_NOT_IMPORTABLE: ${details.specifier} (${details.file})`);
	error.code = "MODULE_INTERNAL_NOT_IMPORTABLE";
	return error;
}

/**
 * Hold an import an instance module that vite's module runner evaluates makes by a specifier only known as it runs
 * (`import(name)`), or what its `import.meta.resolve()` answered, to the rule of {@link refuseInternalImport}. The
 * runner names no importer when it resolves such an import by a path or URL, so the vite plugin has every such
 * `import()` and `import.meta.resolve()` of an instance module go through here (see {@link slothletInstanceImports}):
 * a path, a `file:` URL or a relative specifier that names one of slothlet's own files is refused. A bare specifier is
 * held where vite resolves it.
 * @param {*} specifier - The specifier, or what `import.meta.resolve()` answered.
 * @param {string} importer - The module's `import.meta.url`.
 * @returns {*} `specifier`, when it may be imported.
 * @throws {Error} MODULE_INTERNAL_NOT_IMPORTABLE for one of slothlet's own files.
 * @private
 */
function checkModuleImport(specifier, importer) {
	const text = typeof specifier === "string" ? specifier : String(specifier);
	// A module the instance module imports by a URL that is no file's (`data:`): what it imports is held as the
	// module's own imports are, where Node's loader resolves them.
	if (/^[a-z][a-z0-9+.-]+:/i.test(text) && !text.startsWith("file:") && !text.startsWith("node:")) MODULE_URLS.add(text);
	if (isFileSpecifier(text) || /^[A-Za-z]:[\\/]/.test(text)) {
		let file = text;
		if (!text.startsWith("file:") && !(text.startsWith("/") || /^[A-Za-z]:[\\/]/.test(text))) file = new URL(text, importer).href;
		if (isSlothletInternal(file)) throw importRefusal(text, file);
	}
	return specifier;
}

/**
 * The error the vite plugin throws for a module's import of one of slothlet's own files: slothlet's own error, loaded
 * where the plugin runs (vite's server, which need not have loaded slothlet).
 * @param {string} specifier - The specifier as written.
 * @param {string} file - The file it resolved to.
 * @returns {Promise<Error>} The error.
 * @private
 */
async function viteImportRefusal(specifier, file) {
	if (IMPORT_REFUSAL === null) {
		try {
			const { SlothletError } = await import("@cldmv/slothlet/errors");
			IMPORT_REFUSAL = ({ specifier: named, file: target, allowed }) =>
				new SlothletError("MODULE_INTERNAL_NOT_IMPORTABLE", { specifier: named, file: target, allowed }, null, { validationError: true });
		} catch {
			// Without slothlet's errors loadable here the refusal carries its code alone (see importRefusal).
		}
	}
	return importRefusal(specifier, file);
}

/**
 * Keep slothlet's own files to slothlet: an import or require a module's code makes that resolves to any file of
 * slothlet's code but the runtime's entry files is refused, however it is spelled (a package subpath, `#imports`, a
 * file URL, an absolute or relative path, `import.meta.resolve`, `require.resolve`). The host's own imports, and
 * slothlet's own, resolve as before.
 * @param {string} specifier - The specifier as written.
 * @param {object} context - Node's resolve context.
 * @param {ResolveResult} result - The resolution.
 * @returns {void}
 * @throws {Error} MODULE_INTERNAL_NOT_IMPORTABLE for a module's import of such a file.
 * @private
 */
function refuseInternalImport(specifier, context, result) {
	const url = result?.url;
	if (typeof url === "string" && !url.startsWith("file:") && !url.startsWith("node:") && isModuleImport(context?.parentURL, [])) {
		// A module an instance's file imports by a URL that is no file's: what it imports is held as the file's imports are.
		MODULE_URLS.add(url);
		return;
	}
	if (!isSlothletInternal(url)) return;
	if (isModuleImport(context?.parentURL, context?.conditions)) throw importRefusal(specifier, url);
}

/**
 * Whether an import or require of `specifier` from `parent`, resolved at `child`, reaches a file of the importer's
 * per-instance graph (#715): a relative or `file:` specifier by where the file is ({@link isInstanceScopedFile}); a bare
 * one only when it can name the importer's own package (`#imports`, or the package's own name: {@link mayNameOwnPackage})
 * and resolves into it ({@link isOwnPackageImport}). The one rule Node's ES module imports, CommonJS requires and the vite
 * plugin share, so every spelling of a file reaches one copy per instance.
 * @param {string} specifier - The specifier as written.
 * @param {string} child - Resolved child (`file:` URL, path or vite id), without a query.
 * @param {string} parent - The importer (`file:` URL, path or vite id).
 * @returns {boolean} True when the child is the instance's copy.
 * @private
 */
function belongsToInstance(specifier, child, parent) {
	if (isFileSpecifier(specifier)) return isInstanceScopedFile(child, parent);
	return mayNameOwnPackage(specifier, parent) && isOwnPackageImport(child, parent);
}

/**
 * Copy the slothlet instance query from `parent` onto `child` when the import belongs to the
 * leaf's per-instance graph; otherwise return `child` unchanged. Works on `file:` URLs (Node) and
 * on vite ids (absolute paths with an optional query) alike. When the parent carries {@link HELPERS_PARAM}
 * (the `helpers: "module"` option), the child is the copy of the api file the parent is, or was loaded for.
 * @param {string} specifier - The specifier as written in the importer.
 * @param {string|undefined} parent - The importer's URL or id.
 * @param {string} child - The resolved child URL or id.
 * @returns {string} `child`, with the instance query appended when it applies.
 * @internal
 * @example
 * propagateInstanceQuery("../lib/state.mjs", "file:///app/api/tally.mjs?slothlet_instance=a", "file:///app/lib/state.mjs");
 * // → "file:///app/lib/state.mjs?slothlet_instance=a"
 */
export function propagateInstanceQuery(specifier, parent, child) {
	if (typeof parent !== "string" || !parent.includes(MARKER)) return withoutWrittenHelperTags(parent, child);
	if (typeof child !== "string" || typeof specifier !== "string" || specifier.startsWith("node:")) return child;
	if (!(child.startsWith("file:") || child.startsWith("/") || /^[A-Za-z]:[\\/]/.test(child))) return child;
	const [childBase, childQuery = ""] = splitQuery(child);
	const childParams = new URLSearchParams(childQuery);
	const [parentBase, parentQuery = ""] = splitQuery(parent);
	const parentParams = new URLSearchParams(parentQuery);
	// A child that names its instance itself (a URL the importer wrote out) keeps the instance it names. Which api file
	// a helper copy is loaded for is never the importer's to write: those tags are dropped and given as below.
	const written = childParams.has("slothlet_instance");
	if (written) {
		if (!HELPER_TAGS.some((key) => childParams.has(key))) return child;
		for (const key of HELPER_TAGS) childParams.delete(key);
	} else {
		if (!belongsToInstance(specifier, childBase, parent)) return child;
		for (const key of INSTANCE_QUERY_KEYS) {
			if (parentParams.has(key)) childParams.set(key, parentParams.get(key));
		}
	}
	// Helpers loaded once per importing api file: the copy names the api file it is loaded for (the importer, or the
	// file the importing helper's own copy was loaded for) and that file's mount.
	if (parentParams.get(HELPERS_PARAM) === HELPERS_PER_MODULE) {
		childParams.set(HELPERS_PARAM, HELPERS_PER_MODULE);
		const loadedFor = parentParams.get(HELPERS_FOR_PARAM);
		childParams.set(HELPERS_FOR_PARAM, loadedFor ?? helperImporterPath(parentBase));
		const mount = loadedFor === null ? parentParams.get("module") : parentParams.get(HELPERS_MOUNT_PARAM);
		if (mount !== null) childParams.set(HELPERS_MOUNT_PARAM, mount);
	}
	const hashIdx = childBase.indexOf("#");
	const base = hashIdx === -1 ? childBase : childBase.slice(0, hashIdx);
	const hash = hashIdx === -1 ? "" : childBase.slice(hashIdx);
	return `${base}?${childParams.toString()}${hash}`;
}

/**
 * The tags that say a file is a helper copy loaded for one api file (`helpers: "module"`). Only slothlet gives them:
 * the loader to a leaf, and the resolve hook to what a tagged file imports.
 * @type {string[]}
 * @private
 */
const HELPER_TAGS = [HELPERS_PARAM, HELPERS_FOR_PARAM, HELPERS_MOUNT_PARAM];

/**
 * A resolved child without the helper tags its URL carries, when its importer is neither an instance file nor one of
 * slothlet's own: a package's file, the host's, evaluated code. A URL is text any code can write, and a copy's frames
 * are read by those tags, so a file imported under tags its importer wrote is loaded as the same file without them.
 * @param {string|undefined} parent - The importer's URL or id.
 * @param {string} child - The resolved child URL or id.
 * @returns {string} `child`, without the tags where they were not slothlet's to give.
 * @private
 */
function withoutWrittenHelperTags(parent, child) {
	if (typeof child !== "string" || !child.includes(MARKER)) return child;
	if (!HELPER_TAGS.some((key) => child.includes(`${key}=`))) return child;
	if (typeof parent === "string" && OWN_PREFIXES.some((prefix) => toSlashPath(parent).startsWith(prefix))) return child;
	// Slothlet's loader imports a leaf from its own files; a first import with no importer is the host's entry.
	if (typeof parent !== "string") return child;
	const [childBase, childQuery = ""] = splitQuery(child);
	const childParams = new URLSearchParams(childQuery);
	for (const key of HELPER_TAGS) childParams.delete(key);
	const hashIdx = childBase.indexOf("#");
	const base = hashIdx === -1 ? childBase : childBase.slice(0, hashIdx);
	const hash = hashIdx === -1 ? "" : childBase.slice(hashIdx);
	return `${base}?${childParams.toString()}${hash}`;
}

/**
 * Split a URL/id into its part before `?` and its query (without `?` and without any `#hash`).
 * @param {string} ref - URL or id.
 * @returns {string[]} `[base, query]`; `query` is undefined when there is none.
 * @private
 */
function splitQuery(ref) {
	const q = ref.indexOf("?");
	if (q === -1) return [ref];
	const hash = ref.indexOf("#", q);
	return hash === -1 ? [ref.slice(0, q), ref.slice(q + 1)] : [ref.slice(0, q) + ref.slice(hash), ref.slice(q + 1, hash)];
}

/**
 * Run a CommonJS file through an instance's private CommonJS cache (#518, #534) and return its
 * `module.exports`.
 *
 * Node's `require.cache` is keyed on the file path alone, so the instance-scoped files the require
 * reaches (see {@link isInstanceScopedFile} — the file itself and its relative helpers, never
 * `node_modules` packages or slothlet's own files) are kept in a private cache per instance ID and
 * swapped into `require.cache` only for the duration of this synchronous require: global entries for
 * those files are set aside and restored afterwards, so neither the host's copies nor another
 * instance's copies are ever served, and `require.cache` does not grow. The cache is shared by every
 * leaf and mount of the instance and kept across partial reloads; a full reload rotates the instance
 * ID and so starts a fresh one (the old one is released, see {@link claimInstanceScope}).
 *
 * While the require runs, the scope is active: a relative `require()` of an ES module from a file of
 * the scope is served the instance's copy of that module (the resolve and load hooks of
 * {@link installInstanceImportHooks}).
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance whose copies are served.
 * @param {object} [options] - Options.
 * @param {boolean} [options.fresh=false] - Evaluate the file itself anew instead of serving (and
 *   keeping) the instance's copy of it — how a leaf is loaded, so a partial reload re-runs it.
 * @param {string|null} [options.importer=null] - The api file the copies are served for, when the instance loads
 *   helper files once per importing api file (`helpers: "module"`): a private cache per api file instead of one per
 *   instance.
 * @param {string|null} [options.mount=null] - That api file's mount, carried onto the ES modules it requires.
 * @returns {*} The file's `module.exports`.
 * @private
 */
function scopeRequire(filePath, instanceID, { fresh = false, importer = null, mount = null } = {}) {
	const requireFn = nodeBuiltin("node:module").createRequire(filePath);
	const resolved = requireFn.resolve(filePath);
	const cache = requireFn.cache;
	const outer = ACTIVE;
	if (importer !== null) importer = helperImporterPath(importer);
	// Already inside this scope (a helper reached during its require): the cache is swapped in.
	if (
		!fresh &&
		outer !== null &&
		outer.instanceID === instanceID &&
		(outer.importer ?? null) === importer &&
		(importer === null || (outer.mount ?? null) === mount)
	)
		return requireFn(resolved);

	if (!SCOPE_KEYS.has(instanceID)) SCOPE_KEYS.set(instanceID, Objects.freeze({}));
	let scope;
	if (importer === null) {
		scope = SCOPES.get(instanceID);
		if (!scope) {
			scope = new Map();
			SCOPES.set(instanceID, scope);
		}
	} else {
		// Helpers loaded once per importing api file: that file's own copies.
		let copies = COPIES.get(instanceID);
		if (!copies) COPIES.set(instanceID, (copies = new Map()));
		const copyKey = helperCopyKey(importer, mount);
		scope = copies.get(copyKey);
		if (!scope) copies.set(copyKey, (scope = new Map()));
	}
	const owned = (file) => file === resolved || isInstanceScopedFile(file, resolved);
	const keep = (file) => !(fresh && file === resolved);

	// Set aside every global entry the require must not share, then serve this instance's copies.
	const setAside = new Map();
	for (const file of Objects.keys(cache)) {
		if (owned(file)) {
			setAside.set(file, cache[file]);
			delete cache[file];
		}
	}
	const served = [];
	for (const [file, mod] of scope) {
		if (!keep(file)) continue;
		if (cache[file] !== undefined) setAside.set(file, cache[file]);
		cache[file] = mod;
		served.push(file);
	}

	if (fresh) {
		// A leaf is not kept in the scope (it is evaluated anew each load), but its frames are the instance's code.
		if (!LEAVES.has(instanceID)) LEAVES.set(instanceID, new Set());
		LEAVES.get(instanceID).add(resolved);
	}
	ACTIVE = { instanceID, anchor: resolved, importer, mount };
	try {
		return requireFn(resolved);
	} finally {
		ACTIVE = outer;
		recordScopeRequires(instanceID, cache, owned);
		// Collect this instance's (possibly new) copies, then put the global cache back.
		for (const file of [...Objects.keys(cache).filter(owned), ...served]) {
			if (!(file in cache)) continue;
			if (keep(file)) scope.set(file, cache[file]);
			delete cache[file];
		}
		for (const [file, mod] of setAside) cache[file] = mod;
	}
}

/**
 * How many of each CommonJS module's requires have been recorded (see {@link recordScopeRequires}), so a module is
 * read again only once it has required more.
 * @type {WeakMap<object, number>}
 * @private
 */
const RECORDED_REQUIRES = new WeakMap();

/**
 * Record the requires the files of an instance's CommonJS scope made, read from Node's own modules while the scope's
 * copies are still in Node's require cache. The resolve hook records a require as it is resolved, but Node answers a
 * require from its own caches, without asking the hook, when another file of the same folder made the same require
 * before: that file's require went unrecorded, and the file was missing from the files loading the helper. Node lists
 * on each module the modules it required, however each was answered.
 * @param {string} instanceID - The instance.
 * @param {Record<string, object>} cache - Node's require cache, with the scope's copies in it.
 * @param {function(string): boolean} owned - Whether a file is one of the scope's.
 * @returns {void}
 * @private
 */
function recordScopeRequires(instanceID, cache, owned) {
	for (const file of Objects.keys(cache)) {
		if (!owned(file)) continue;
		const children = cache[file]?.children;
		if (!Arrays.isArray(children) || RECORDED_REQUIRES.get(cache[file]) === children.length) continue;
		RECORDED_REQUIRES.set(cache[file], children.length);
		for (const child of children) {
			const required = child?.filename;
			if (typeof required === "string" && required !== file && owned(required)) recordImport(instanceID, file, required);
		}
	}
}

/**
 * Record that one file of an instance imports or requires another.
 * @param {string} instanceID - The instance.
 * @param {string} parent - The importing file's URL or path.
 * @param {string} child - The imported file's URL or path.
 * @returns {void}
 * @private
 */
function recordImport(instanceID, parent, child) {
	// Through the shared object, so every copy's imports land in the one record its readers read.
	sharedState().recordImports(instanceID, parent, [child]);
}

/**
 * The import graph of an instance's own code: for each file a leaf of the instance reached through an
 * import or require that carries the instance (#601 review), the files that import it. The live runtime
 * walks it upwards to tell which leaves a stack frame's code belongs to.
 * What comes back is a read-only view (see graphView): it reads as a `Map` of importers by imported file does, hands
 * out each collection of importers as a copy, and is one object per instance for as long as its graph lives.
 * @param {string} instanceID - The instance ID.
 * @returns {object|null} Importers by imported file (forward-slash paths), or null.
 * @internal
 * @example
 * instanceImporters("inst-a")?.get("/app/lib/state.mjs"); // Set { "/app/api/tally.mjs" }
 */
export function instanceImporters(instanceID) {
	return sharedState().imports.of(instanceID);
}

/**
 * The files of an instance's CommonJS code (#534): its CommonJS leaves and the helpers they required.
 * They run under their plain path, with no import query, so the live runtime looks a stack frame up
 * here to tell the instance's code from the host's (#601 review).
 * @param {string} instanceID - The instance ID.
 * @returns {string[]} Absolute paths, as Node's require cache keys them.
 * @internal
 * @example
 * instanceCommonJSFiles("inst-a"); // ["/app/lib/state.cjs"]
 */
export function instanceCommonJSFiles(instanceID) {
	return sharedState().commonJS.files(instanceID);
}

/**
 * What a reader can key what it derived from {@link instanceCommonJSFiles} on (#601 review): an object standing for
 * the instance's CommonJS state, dropped by the instance's release, and how many files the instance has. Files are
 * only ever added while the instance lives, so an equal count means the same files. The object holds nothing.
 * @param {string} instanceID - The instance ID.
 * @returns {{key: object, count: number}|null} The key and file count, or null when it has none.
 * @internal
 * @example
 * instanceCommonJSVersion("inst-a"); // { key: {}, count: 3 }
 */
export function instanceCommonJSVersion(instanceID) {
	return sharedState().commonJS.version(instanceID);
}

/**
 * Drop everything kept for an instance ID: its private CommonJS copies (#534), its import graph, the sources recorded
 * for its own copies of its files (#597), and its claim. Its ES module copies stay in Node's module cache (which has
 * no eviction) but are no longer reachable from a live instance.
 * @param {string} instanceID - The instance ID.
 * @returns {void}
 * @private
 */
function releaseScope(instanceID) {
	SCOPES.delete(instanceID);
	COPIES.delete(instanceID);
	LEAVES.delete(instanceID);
	SCOPE_KEYS.delete(instanceID);
	IMPORT_GRAPHS.delete(instanceID);
	GRAPH_VIEWS.delete(instanceID);
	CLAIMS.delete(instanceID);
	OWN_CLAIMS.delete(instanceID);
	for (const [ticket, held] of TICKETS) if (held.instanceID === instanceID) TICKETS.delete(ticket);
	// The scripts this copy recorded for the instance's own copies of its files go with it (#597).
	for (const key of LOADED_SCRIPTS.keys()) {
		if (scriptKeyInstance(key) !== String(instanceID)) continue;
		LOADED_SCRIPTS.delete(key);
		LOADED_TEXTS.delete(key);
	}
}

/**
 * Claim an instance ID in this copy's state: the `claim` of the shared object. The first to claim an ID gets a handle
 * for it; while the claim stands, no one else gets one, and only the handle loads a file as the instance's or
 * releases what is kept for it. What was kept under the ID before it was claimed is dropped.
 * @param {string} instanceID - The instance ID.
 * @returns {{instanceID: string, require: function(string, object=): *, release: function(): void}|null} The handle,
 *   or null when the ID is not a string, or is claimed already.
 * @private
 */
function claimHere(instanceID) {
	if (typeof instanceID !== "string" || instanceID === "" || CLAIMS.has(instanceID)) return null;
	// What a URL carrying the ID had recorded before the ID was claimed is not the claimer's.
	if (SCOPE_KEYS.has(instanceID) || IMPORT_GRAPHS.has(instanceID)) releaseScope(instanceID);
	const handle = Objects.freeze({
		instanceID,
		require: (filePath, options) => {
			if (CLAIMS.get(instanceID) !== handle) throw new TypeError(`The files of instance "${instanceID}" have been released.`);
			return scopeRequire(filePath, instanceID, options);
		},
		release: () => {
			if (CLAIMS.get(instanceID) === handle) releaseScope(instanceID);
		}
	});
	CLAIMS.set(instanceID, handle);
	return handle;
}

/**
 * Claim an instance ID for the instance that carries it, before any of its files load. The handle is how the instance
 * loads its CommonJS files ({@link scopeRequire}) and, when it shuts down or takes a new ID, releases what slothlet
 * keeps about its files. The instance keeps the handle to itself: nothing else can load a file as the instance's code
 * or drop what is recorded about it, whatever it can import or reach through the global object. With two copies of
 * slothlet in the process, the copy that loaded first keeps every instance's record, and this claims there.
 * @param {string} instanceID - The instance ID.
 * @returns {{instanceID: string, require: function(string, object=): *, release: function(): void}|null} The handle,
 *   or null when the ID is claimed already.
 * @internal
 * @example
 * const scope = claimInstanceScope(instanceID);
 * scope.require("/app/api/counter.cjs", { fresh: true });
 * scope.release();
 */
export function claimInstanceScope(instanceID) {
	const handle = sharedState().claim(instanceID) ?? null;
	// Claimed by this copy's own slothlet: its files are given this copy's runtime (see isOtherCopysFile).
	if (handle && isKeeper()) OWN_CLAIMS.add(instanceID);
	return handle;
}

/**
 * The handle of an instance ID for a caller that holds none: claimed on first use by this copy of slothlet, for an ID
 * no instance has claimed.
 * @param {string} instanceID - The instance ID.
 * @returns {{instanceID: string, require: function(string, object=): *, release: function(): void}} The handle.
 * @throws {TypeError} When the ID is claimed by an instance.
 * @private
 */
function unheldScope(instanceID) {
	let handle = UNHELD.get(instanceID);
	if (!handle) {
		handle = claimInstanceScope(instanceID);
		if (!handle) throw new TypeError(`The files of instance "${instanceID}" are loaded by the instance alone.`);
		UNHELD.set(instanceID, handle);
	}
	return handle;
}

/**
 * Run a CommonJS file through the private CommonJS cache of an instance ID no instance has claimed (see
 * {@link scopeRequire} for what that does): for a caller that is not an instance, such as a test of the cache. An
 * instance loads its files through the handle it claimed ({@link claimInstanceScope}); for an ID an instance holds,
 * this throws.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance ID whose copies are served.
 * @param {object} [options] - Options, as {@link scopeRequire} takes them (`fresh`, `importer`, `mount`).
 * @returns {*} The file's `module.exports`.
 * @throws {TypeError} When the ID is claimed by an instance.
 * @internal
 * @example
 * const exports = requireInInstance("/app/api/counter.cjs", "inst-a", { fresh: true });
 */
export function requireInInstance(filePath, instanceID, options) {
	return unheldScope(instanceID).require(filePath, options);
}

/**
 * Drop what is kept for an instance ID that {@link requireInInstance} claimed, or that no one claimed (what the hooks
 * recorded for a URL carrying it). An ID an instance holds is released by the instance's own handle, and is left as
 * it is here.
 * @param {string|null|undefined} instanceID - The instance ID.
 * @returns {void}
 * @internal
 * @example
 * releaseInstanceScope("inst-a");
 */
export function releaseInstanceScope(instanceID) {
	if (instanceID == null) return;
	const handle = UNHELD.get(instanceID);
	if (handle) {
		UNHELD.delete(instanceID);
		handle.release();
		return;
	}
	if (isKeeper() && !CLAIMS.has(instanceID)) releaseScope(instanceID);
}

/**
 * `require()` an ES module under its instance URL: return what Node's own `require(esm)` returns —
 * the namespace, its `"module.exports"` export when it has one, or for a module with a default export
 * (and no `__esModule` export) the namespace with `__esModule: true` added. The namespace is the one
 * an `import` of the same instance URL yields, so ESM and CommonJS importers of the instance share
 * one copy.
 * @param {string} url - The ES module's `file:` URL carrying the instance query.
 * @returns {*} The value `require()` returns.
 * @private
 */
function requireESM(url) {
	const requireFn = nodeBuiltin("node:module").createRequire(import.meta.url);
	/**
	 * Synchronously load one virtual module, without leaving it in `require.cache`.
	 * @param {string} id - The virtual module id.
	 * @returns {*} Its `require()` value.
	 */
	const requireVirtual = (id) => {
		try {
			return requireFn(id);
		} finally {
			delete requireFn.cache[id];
		}
	};
	const namespace = requireVirtual(ESM_PREFIX + url);
	if ("module.exports" in namespace) return namespace["module.exports"];
	if (!("default" in namespace) || "__esModule" in namespace) return namespace;
	return requireVirtual(FACADE_PREFIX + url);
}

/**
 * Answer a `require()` an instance's ES module made of a file of its instance (`createRequire(import.meta.url)`, #755):
 * the instance's copy of the file, as an `import` of it from the same module gives. Called by the CommonJS stub the
 * load hook generates for such a require. Node keeps one module per file path for the whole process, so the stub's
 * entry is taken out of Node's require cache before anything else: left there, the first instance's copy would be
 * handed to every later instance, and to the host, without the hooks being asked again.
 * @param {string} url - The file's URL carrying the instance query.
 * @param {string} format - `"module"` for an ES module; anything else is run through the instance's CommonJS cache.
 * @param {object} stub - The stub's own `module`.
 * @returns {*} The value `require()` returns.
 * @private
 */
function requireFromModule(url, format, stub) {
	const { createRequire } = nodeBuiltin("node:module");
	const cache = createRequire(import.meta.url).cache;
	for (const key of [stub?.id, stub?.filename]) if (typeof key === "string" && cache[key] === stub) delete cache[key];
	if (format === "module") return requireESM(url);
	const [base, query = ""] = splitQuery(url);
	const params = new URLSearchParams(query);
	return scopeRequire(nodeBuiltin("node:url").fileURLToPath(base), params.get("slothlet_instance"), {
		importer: helperCopyImporter(params),
		mount: params.get(HELPERS_MOUNT_PARAM)
	});
}

/**
 * Write a ticket for one thing a piece of generated code may do. The load hook generates code that has to reach back
 * into slothlet: the wrapper of a CommonJS helper, the stub of a required ES module. Generated code can only reach
 * slothlet through the global object, which every module can reach too, so the hook writes a ticket into the code: a
 * name no one can guess, good once, for that one load. The code hands it to `redeem` on the shared object and gets
 * the entry points back; code without a ticket gets nothing.
 * @param {string|null} instanceID - The instance the generated code is loaded for; its tickets go when it is released.
 * @param {Function} job - What the code may do.
 * @returns {string} The ticket.
 * @private
 */
function mintTicket(instanceID, job) {
	const ticket = HOST.randomUUID();
	TICKETS.set(ticket, { instanceID, job });
	return ticket;
}

/**
 * Take a ticket the load hook wrote into generated code (see {@link mintTicket}): the `redeem` of the shared object.
 * A ticket is taken once. Whichever entry point the code then calls, with whatever arguments, does the one thing the
 * ticket was written for; the arguments are in the generated code for a reader, and only the stub's own `module` is
 * taken from them.
 * @param {string} ticket - The ticket.
 * @returns {{requireCJS: Function, requireESM: Function, requireFromModule: Function}} The entry points.
 * @throws {TypeError} When the ticket is not one the hook wrote, or was taken already.
 * @private
 */
function redeemTicket(ticket) {
	const held = TICKETS.get(ticket);
	if (!held) throw new TypeError("This code was not generated by slothlet's load hook for this load.");
	TICKETS.delete(ticket);
	const { job } = held;
	return Objects.freeze({
		requireCJS: () => job(),
		requireESM: () => job(),
		requireFromModule: (url, format, stub) => job(stub)
	});
}

/**
 * Register frame placement's check of who is calling into slothlet: given an `Error` slothlet created on entry, the
 * location of the module whose own top-level code made the call, when vitest's or vite's module runner was evaluating
 * that module, else null. Taken once, by the copy that keeps the shared object.
 * @param {function(Error): (string|null)} check - The check.
 * @returns {void}
 * @internal
 */
export function setCallerCheck(check) {
	if (isKeeper() && CALLER_CHECK === null && typeof check === "function") CALLER_CHECK = check;
}

/**
 * Entry point of the wrapper the vite plugin generates for a CommonJS helper an instance file imports (#534): the
 * `requireCJS` of the shared object. The plugin runs in vite's server, which cannot hand the process that evaluates
 * the wrapper a ticket, so the call is taken on what the stack shows instead: it has to come from the top level of
 * the module vitest's or vite's runner is evaluating for that very file under the instance's query (see
 * {@link setCallerCheck}). The file, the instance, and the api file a copy is loaded for are read from that module's
 * own id, never from the arguments. Under Node's own loader nothing is evaluated by such a runner, and the call is
 * refused.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance ID.
 * @returns {*} The file's `module.exports`.
 * @throws {TypeError} When the call does not come from such a wrapper.
 * @private
 */
function requireCJSFromRunner(filePath, instanceID) {
	const previousLimit = PristineError.stackTraceLimit;
	PristineError.stackTraceLimit = 64;
	let entry;
	try {
		entry = new PristineError();
	} finally {
		PristineError.stackTraceLimit = previousLimit;
	}
	const location = CALLER_CHECK?.(entry) ?? null;
	if (typeof location === "string") {
		const [base, query = ""] = splitQuery(location);
		const params = new URLSearchParams(query);
		if (toSlashPath(base) === toSlashPath(String(filePath)) && params.get("slothlet_instance") === instanceID && instanceID) {
			return scopeRequire(filePath, instanceID, { importer: helperCopyImporter(params), mount: params.get(HELPERS_MOUNT_PARAM) });
		}
	}
	throw new TypeError("requireCJS is the entry point of the wrapper slothlet's vite plugin generates for a CommonJS helper.");
}

/**
 * Whether a resolve/load context's conditions include `name` (an array on the import path; a Set on
 * Node 22's require path).
 * @param {Iterable<string>|undefined} conditions - The context's conditions.
 * @param {string} name - The condition.
 * @returns {boolean} True when present.
 * @private
 */
function hasCondition(conditions, name) {
	if (conditions == null) return false;
	return typeof conditions.has === "function" ? conditions.has(name) : Arrays.prototype.includes.call(conditions, name);
}

/**
 * Mark a `require()` resolution made inside an active instance scope (#534): a require from a file of
 * the scope that resolves to a possible ES module of the instance's graph — by a relative path, or by
 * `#imports` or the package's own name into its own package (#715) — gets the instance query plus
 * {@link REQUIRE_PARAM}, so the load hook can serve it the instance's copy: the module an `import` of
 * the file from the instance's ES module code gets. CommonJS targets are already served by the
 * scope's private cache, which holds every file of the package by its path, and are left alone.
 * @param {string} specifier - The specifier as written.
 * @param {object} context - Node's resolve context.
 * @param {ResolveResult} result - The next hook's result.
 * @param {{ instanceID: string, anchor: string }} active - The active scope.
 * @returns {ResolveResult} `result`, marked when the rule applies.
 * @private
 */
function markScopedRequire(specifier, context, result, active) {
	const url = result?.url;
	if (typeof url !== "string" || !url.startsWith("file:") || url.includes("?") || /\.(?:cjs|json|node)$/.test(url)) return result;
	if (!hasCondition(context?.conditions, "require")) return result;
	const parent = context.parentURL;
	if (typeof parent !== "string" || !isInstanceScopedFile(parent, active.anchor) || !belongsToInstance(specifier, url, parent))
		return result;
	const query = new URLSearchParams({ slothlet_instance: active.instanceID });
	// Inside the copies of one api file (`helpers: "module"`), the ES module is that file's copy too.
	if (active.importer) {
		query.set(HELPERS_PARAM, HELPERS_PER_MODULE);
		query.set(HELPERS_FOR_PARAM, active.importer);
		if (active.mount) query.set(HELPERS_MOUNT_PARAM, active.mount);
	}
	query.set(REQUIRE_PARAM, "1");
	return { ...result, url: `${url}?${query}` };
}

/**
 * Source of the ES module that stands in for a CommonJS helper imported by an instance (#534): it
 * runs the file through the instance's private CommonJS cache and exports what Node's own
 * ESM-to-CommonJS import exports — `default` (`module.exports`), `"module.exports"`, and the named
 * exports found by a static scan of the source, read from `module.exports` once it has run.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance ID.
 * @param {string|null|undefined|Uint8Array} source - Its source, when the loader already read it.
 * @param {string|null} [importer=null] - The api file the copy is loaded for (`helpers: "module"`): the file then
 *   runs through that api file's own CommonJS cache.
 * @param {string|null} [mount=null] - That api file's mount.
 * @returns {string} The wrapper's ES module source.
 * @internal
 * @example
 * commonJSWrapperSource("/app/lib/state.cjs", "inst-a", null);
 */
export function commonJSWrapperSource(filePath, instanceID, source, importer = null, mount = null) {
	return wrapperSource(filePath, instanceID, source, importer, mount, STATE_REF);
}

/**
 * {@link commonJSWrapperSource}, with the expression the wrapper reaches its entry point through: the shared object
 * for the vite plugin's wrapper, the shared object with a ticket taken for the load hook's.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance ID.
 * @param {string|null|undefined|Uint8Array} source - Its source, when the loader already read it.
 * @param {string|null} importer - The api file the copy is loaded for (`helpers: "module"`).
 * @param {string|null} mount - That api file's mount.
 * @param {string} entry - The expression `requireCJS` is called on.
 * @returns {string} The wrapper's ES module source.
 * @private
 */
function wrapperSource(filePath, instanceID, source, importer, mount, entry) {
	const fs = nodeBuiltin("node:fs");
	const { createRequire } = nodeBuiltin("node:module");
	const text = source == null ? fs.readFileSync(filePath, "utf8") : typeof source === "string" ? source : new TextDecoder().decode(source);
	const names = new Set(
		commonJSExportNames(filePath, text, {
			readFile: (file) => fs.readFileSync(file, "utf8"),
			resolve: (specifier, fromFile) => createRequire(fromFile).resolve(specifier)
		})
	);
	// Like Node, a module that has already run contributes the keys it actually exports.
	const loaded = (
		importer === null ? SCOPES.get(instanceID) : COPIES.get(instanceID)?.get(helperCopyKey(helperImporterPath(importer), mount))
	)?.get(filePath);
	if (loaded?.loaded && loaded.exports !== null && (typeof loaded.exports === "object" || typeof loaded.exports === "function")) {
		for (const key of Objects.keys(loaded.exports)) if (key !== "default" && key.isWellFormed()) names.add(key);
	}
	names.delete("module.exports");
	const lines = [
		`const m = ${entry}.requireCJS(${JSON.stringify(filePath)}, ${JSON.stringify(instanceID)}${
			importer === null ? "" : `, ${JSON.stringify(importer)}, ${JSON.stringify(mount)}`
		});`,
		"export default m;",
		'export { m as "module.exports" };'
	];
	let n = 0;
	for (const name of names) {
		lines.push(`const n${n} = m == null ? undefined : m[${JSON.stringify(name)}];`, `export { n${n} as ${JSON.stringify(name)} };`);
		n++;
	}
	return lines.join("\n") + "\n";
}

/**
 * The api file a helper copy's URL says it was loaded for (see {@link HELPERS_PARAM}), or null for a helper loaded
 * once per instance.
 * @param {URLSearchParams} params - The URL's query.
 * @returns {string|null} The api file's path.
 * @private
 */
function helperCopyImporter(params) {
	return params.get(HELPERS_PARAM) === HELPERS_PER_MODULE ? params.get(HELPERS_FOR_PARAM) : null;
}

/**
 * Load-hook body for a URL carrying the instance marker (#534).
 * @param {string} url - The module URL.
 * @param {object} context - Node's load context.
 * @param {Function} nextLoad - Node's next load function.
 * @returns {object} The load result.
 * @private
 */
function loadInstanceModule(url, context, nextLoad) {
	if (url.startsWith(ESM_PREFIX)) {
		const target = JSON.stringify(url.slice(ESM_PREFIX.length));
		return { format: "module", shortCircuit: true, source: `import * as ns from ${target};\nexport { ns as "module.exports" };\n` };
	}
	if (url.startsWith(FACADE_PREFIX)) {
		const target = JSON.stringify(url.slice(FACADE_PREFIX.length));
		return {
			format: "module",
			shortCircuit: true,
			source: `export * from ${target};\nexport { default } from ${target};\nexport const __esModule = true;\n`
		};
	}
	const result = nextLoad(url, context);
	if (!url.startsWith("file:")) return result;
	const [base, query = ""] = splitQuery(url);
	const params = new URLSearchParams(query);
	// A CommonJS file's source is recorded as it is loaded, as an ES module's is below (#597) — but not a package's
	// under `node_modules` as written: frame placement hashes such a file from disk when it needs to.
	if (shouldRecordCommonJS(base, result)) recordLoadedSource(url, result);
	if (params.has(MODULE_REQUIRE_PARAM)) {
		// require() made by an instance's ES module: the instance's copy, from a stub that leaves Node's cache (#755).
		params.delete(MODULE_REQUIRE_PARAM);
		const target = `${base}?${params}`;
		const format = result?.format === "module" || result?.format === "module-typescript" ? "module" : "commonjs";
		const ticket = mintTicket(params.get("slothlet_instance"), (stub) => requireFromModule(target, format, stub));
		return {
			format: "commonjs",
			shortCircuit: true,
			source: `module.exports = ${STATE_REF}.redeem(${JSON.stringify(ticket)}).requireFromModule(${JSON.stringify(target)}, ${JSON.stringify(format)}, module);\n`
		};
	}
	if (params.has(REQUIRE_PARAM)) {
		// require() of a file in an instance scope: an ES module is served the instance's copy;
		// anything else is CommonJS (or JSON/addon) and already served by the scope's private cache.
		if (result?.format !== "module") return result;
		params.delete(REQUIRE_PARAM);
		const target = `${base}?${params}`;
		const ticket = mintTicket(params.get("slothlet_instance"), () => requireESM(target));
		return {
			format: "commonjs",
			shortCircuit: true,
			source: `module.exports = ${STATE_REF}.redeem(${JSON.stringify(ticket)}).requireESM(${JSON.stringify(target)});\n`
		};
	}
	const instanceID = params.get("slothlet_instance");
	if ((result?.format === "module" || result?.format === "module-typescript") && instanceID !== null) recordLoadedSource(url, result);
	if (result?.format !== "commonjs" || instanceID === null) return result;
	const filePath = nodeBuiltin("node:url").fileURLToPath(base);
	const importer = helperCopyImporter(params);
	const mount = params.get(HELPERS_MOUNT_PARAM);
	const ticket = mintTicket(instanceID, () => scopeRequire(filePath, instanceID, { importer, mount }));
	return {
		format: "module",
		shortCircuit: true,
		source: wrapperSource(filePath, instanceID, result.source, importer, mount, `${STATE_REF}.redeem(${JSON.stringify(ticket)})`)
	};
}

/**
 * Whether a load result is a CommonJS file's: its format says so, or — for a `require()` of a file with an extension
 * Node does not know, which it compiles as CommonJS — it names no format and carries the source text.
 * @param {object|undefined} result - The load result.
 * @returns {boolean} True for a CommonJS file's source.
 * @private
 */
function isCommonJSLoad(result) {
	return (
		result?.format === "commonjs" ||
		result?.format === "commonjs-typescript" ||
		(result?.format == null && typeof result?.source === "string")
	);
}

/**
 * Whether a CommonJS file's source is recorded as it loads (see {@link recordLoadedSource}): every CommonJS file but a
 * package's under `node_modules` loaded as it is written, whose source frame placement hashes from disk when it needs
 * to (#597).
 * @param {string} url - The file's URL.
 * @param {object|undefined} result - The load result.
 * @returns {boolean} True when it is recorded.
 * @private
 */
function shouldRecordCommonJS(url, result) {
	if (!isCommonJSLoad(result)) return false;
	return isTypeScriptLoad(result) || !/\/node_modules\//.test(splitQuery(url)[0]);
}

/**
 * Whether a load result is TypeScript Node strips the types from before compiling it.
 * @param {object|undefined} result - The load result.
 * @returns {boolean} True for a TypeScript source.
 * @private
 */
function isTypeScriptLoad(result) {
	return result?.format === "commonjs-typescript" || result?.format === "module-typescript";
}

/**
 * How many script hashes are kept for one script key; a file loaded again with another source past that forgets its
 * oldest. Frame placement keeps the scripts it learns to the same number, newest kept.
 * @type {number}
 * @internal
 */
export const SCRIPTS_PER_KEY = 16;

/**
 * Add a hash to a list of the newest {@link SCRIPTS_PER_KEY}: one already there becomes the newest again.
 * @param {Array<string>} hashes - The list, oldest first.
 * @param {string} hash - The hash.
 * @returns {void}
 * @internal
 */
export function rememberNewest(hashes, hash) {
	const index = hashes.indexOf(hash);
	if (index !== -1) hashes.splice(index, 1);
	hashes.push(hash);
	if (hashes.length > SCRIPTS_PER_KEY) hashes.splice(0, hashes.length - SCRIPTS_PER_KEY);
}

/**
 * The key a URL's script hashes are kept under (#597): the one frame placement reads a frame's location under —
 * registered by it (see {@link setScriptKey}) — so a reload of a file, under a new cache-busting query, keeps to its
 * one entry. The URL itself until one is registered.
 * @param {string} url - The URL.
 * @returns {string} The key.
 * @private
 */
function scriptKeyOf(url) {
	return sharedState().scriptKeyOf(url);
}

/**
 * Register how a URL is reduced to the key its script hashes are kept under (see {@link scriptKeyOf}).
 * @param {function(string): string} keyOf - The URL's key.
 * @returns {void}
 * @internal
 */
export function setScriptKey(keyOf) {
	// Taken once, by the copy that keeps the record: a key that could be swapped would let every location share the
	// sources of one.
	if (isKeeper() && SCRIPT_KEY_OF === null && typeof keyOf === "function") SCRIPT_KEY_OF = keyOf;
}

/**
 * Record the hash of the source an instance's ES module, or any CommonJS file, is compiled from (#597): the SHA-256
 * V8 reports for every frame of that script (`CallSite#getScriptHash()`), so code compiled elsewhere under the file's
 * name — whose script has another hash — is not taken for it. V8 hashes the text it compiles: the source decoded as
 * UTF-8 (a byte that is not UTF-8 becomes U+FFFD) without a byte-order mark, which both loaders drop. Kept by script
 * key, the newest {@link SCRIPTS_PER_KEY} each, where frame placement reads them; an instance's are dropped when it
 * shuts down (see {@link releaseInstanceScope}). Best effort, since a hook registered after this one could still
 * change the source, which only makes such frames fail closed. TypeScript is hashed as Node compiles it, its types
 * stripped.
 * @param {string} url - The module URL, query included.
 * @param {{format?: string, source?: string|ArrayBufferView|ArrayBuffer}} result - The load hook's result.
 * @returns {void}
 * @private
 */
function recordLoadedSource(url, result) {
	const source = result?.source;
	if (source === undefined || source === null) return;
	let text;
	if (typeof source === "string") text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
	else if (ArrayBuffer.isView(source) || source instanceof ArrayBuffer) text = HOST.decode(source);
	else return;
	if (isTypeScriptLoad(result)) {
		const strip = nodeBuiltin("node:module").stripTypeScriptTypes;
		// The stripping Node does to compile the file, done here without the notice the API itself gives on first use.
		const emitWarning = globalThis.process.emitWarning;
		globalThis.process.emitWarning = () => {};
		try {
			if (typeof strip === "function") text = strip(text);
		} catch {
			// Source Node cannot strip fails to load anyway; its text is recorded as it is.
		} finally {
			globalThis.process.emitWarning = emitWarning;
		}
	}
	const hash = HOST.sha256(text);
	const key = scriptKeyOf(url);
	let hashes = LOADED_SCRIPTS.get(key);
	if (!hashes) LOADED_SCRIPTS.set(key, (hashes = []));
	rememberNewest(hashes, hash);
	// The text itself, for where each leaf's function sits in it (see LOADED_TEXTS); only the sources still listed.
	let texts = LOADED_TEXTS.get(key);
	if (!texts) LOADED_TEXTS.set(key, (texts = new Map()));
	texts.set(hash, text);
	for (const known of texts.keys()) if (!hashes.includes(known)) texts.delete(known);
}

/**
 * Whether sources are recorded for a script key, and whether a given one is among them (see
 * {@link recordLoadedSource}).
 * @param {string} key - The script key.
 * @param {string} [hash] - A script's hash.
 * @returns {{known: boolean, has: boolean}} The answer.
 * @internal
 */
export function loadedScriptLookup(key, hash) {
	return sharedState().scripts.lookup(key, hash);
}

/**
 * The text of a source recorded for a script key (see {@link recordLoadedSource}): the one with the given hash, or the
 * newest when no hash is given. Undefined when none is recorded (the hook did not load the file, or another slothlet
 * copy's hook did and keeps no text).
 * @param {string} key - The script key.
 * @param {string|null} [hash] - The script's hash.
 * @returns {string|undefined} The text.
 * @internal
 * @example
 * loadedScriptText(key, frame.hash); // "export const a = () => 1;\n"
 */
export function loadedScriptText(key, hash) {
	return sharedState().scripts.text(key, hash);
}

/**
 * The URLs of the files that import a package file, as the resolve hook recorded them (#597).
 * @param {string} path - The package file's path.
 * @returns {Array<string>} The importers' URLs.
 * @internal
 */
export function packageImporters(path) {
	return sharedState().scripts.packageImporters(path);
}

/**
 * The hashes recorded for the script a URL loads, oldest first.
 * @param {string} url - The URL.
 * @returns {Array<string>} The hashes.
 * @internal
 * @example
 * recordedScriptHashes("file:///app/api/x.mjs?slothlet_instance=a"); // ["…"]
 */
export function recordedScriptHashes(url) {
	return sharedState().scripts.hashes(scriptKeyOf(url));
}

/**
 * How many script keys have hashes recorded.
 * @returns {number} The count.
 * @internal
 * @example
 * recordedScriptCount(); // 12
 */
export function recordedScriptCount() {
	return sharedState().scripts.count();
}

/**
 * The instance a script key names, or null for code no instance tagged.
 * @param {string} key - A script key: path, instance tag and mount tag, NUL-separated.
 * @returns {string|null} The instance ID.
 * @internal
 */
export function scriptKeyInstance(key) {
	return key.split("\u0000")[1] || null;
}

/**
 * Resolve-result shape shared by Node's resolve hooks.
 * @typedef {object} ResolveResult
 * @property {string} url - The resolved module URL.
 * @property {string} [format] - The module format hint.
 * @property {boolean} [shortCircuit] - Whether the chain was short-circuited.
 * @internal
 */

/**
 * Node's next-in-chain resolve function.
 * @callback NextResolve
 * @param {string} specifier - The specifier to resolve.
 * @param {object} [context] - The resolve context.
 * @returns {ResolveResult|Promise<ResolveResult>} The resolution.
 * @internal
 */

/**
 * Apply the propagation rule to one resolution result.
 * @param {string} specifier - The specifier as written.
 * @param {object} context - Node's resolve context (`parentURL`).
 * @param {ResolveResult} result - The next hook's result.
 * @returns {ResolveResult} `result`, with its url carrying the instance query when it applies.
 * @private
 */
function applyToResult(specifier, context, result) {
	const parentURL = context?.parentURL;
	if (typeof parentURL === "string" && parentURL.includes(MARKER)) {
		const url = propagateInstanceQuery(specifier, parentURL, result?.url);
		// The child is the instance's own copy: an edge of its import graph.
		if (typeof url === "string" && url.includes(MARKER)) {
			const instanceID = new URLSearchParams(splitQuery(parentURL)[1] ?? "").get("slothlet_instance");
			if (instanceID) recordImport(instanceID, parentURL, url);
			// A require() the module makes itself (`createRequire`): marked, so the load hook serves the instance's copy
			// without leaving it in Node's require cache, which is keyed on the file's path alone (#755). Node reads a JSON
			// file and an addon by their extension, whatever a hook answers, so those load as before: once per process.
			if (url.startsWith("file:") && hasCondition(context?.conditions, "require") && !/\.(?:json|node)$/.test(splitQuery(url)[0])) {
				return { ...result, url: `${url}&${MODULE_REQUIRE_PARAM}=1` };
			}
		}
		return url === result?.url ? result : { ...result, url };
	}
	// An importer that is no instance file gives a file no helper tags (see withoutWrittenHelperTags).
	const untagged = withoutWrittenHelperTags(parentURL, result?.url);
	if (untagged !== result?.url) result = { ...result, url: untagged };
	const active = ACTIVE;
	if (!active) return result;
	// A require inside an instance's CommonJS scope (see requireInInstance): its relative files, and those of its own
	// package it names by `#imports` or by the package's name (#715), are the instance's copies, so the require is an
	// edge of the instance's graph.
	const url = result?.url;
	if (typeof parentURL === "string" && parentURL.startsWith("file:") && typeof url === "string" && url.startsWith("file:")) {
		if (belongsToInstance(specifier, splitQuery(url)[0], parentURL)) recordImport(active.instanceID, parentURL, url);
	}
	return markScopedRequire(specifier, context, result, active);
}

/**
 * Register the resolve and load hooks with Node, once per process: the hooks of the slothlet copy that keeps every
 * instance's record (the first to load), which another copy asks to register them.
 * The resolve hook copies a leaf's instance query onto its relative imports and marks relative
 * `require()`s made inside an instance scope; the load hook serves the cross-module-system cases
 * (#534) and passes every unmarked URL straight through.
 * Uses the synchronous in-thread `module.registerHooks()` (Node >= 22.15 / 23.5, slothlet's engines
 * floor). The off-thread `module.register()` is deliberately not used: it adds a cross-thread round
 * trip to every import in the process and reorders module evaluation enough to break leaves that
 * start a fire-and-forget runtime import. A host without `registerHooks()` is left untouched.
 * @param {object} nodeModule - The `node:module` namespace.
 * @param {object} [registry=globalThis] - The global object in production. Any other object is a registry of the
 *   caller's own: this copy's hooks are then registered on `nodeModule` once per registry, whichever copy keeps the
 *   record.
 * @returns {boolean} True when a hook is (now or already) registered.
 * @internal
 * @example
 * installInstanceImportHooks(await import("node:module"));
 */
export function installInstanceImportHooks(nodeModule, registry = globalThis) {
	if (registry !== globalThis) {
		// A registry of the caller's own: this copy's hooks, registered once per registry.
		if (registry[INSTALLED]) return true;
		if (typeof nodeModule?.registerHooks !== "function") return false;
		nodeModule.registerHooks(HOOKS);
		Objects.defineProperty(registry, INSTALLED, { value: true, enumerable: false });
		return true;
	}
	// The hooks read what slothlet keeps about each instance's files, so they are the keeping copy's.
	if (!isKeeper()) return sharedState().hooks() === true;
	if (HOOKED) return true;
	if (typeof nodeModule?.registerHooks !== "function") return false;
	nodeModule.registerHooks(HOOKS);
	HOOKED = true;
	return true;
}

/**
 * The hooks {@link installInstanceImportHooks} registers.
 * @type {{resolve: Function, load: Function}}
 * @private
 */
const HOOKS = Objects.freeze({
	resolve: (specifier, context, nextResolve) => {
		// The two virtual modules behind require(esm) (#534) resolve to themselves.
		if (specifier.startsWith(ESM_PREFIX) || specifier.startsWith(FACADE_PREFIX) || specifier.startsWith(OWN_MODULE_PREFIX)) {
			return { url: specifier, format: "module", shortCircuit: true };
		}
		const next = nextResolve(specifier, context);
		refuseInternalImport(specifier, context, next);
		const resolved = applyToResult(specifier, context, next);
		// Who imports a package's file, so its code can be told whose it is (#597); an instance's require() of it is
		// answered so that every later one is recorded too.
		if (SERVING === null || SERVING !== resolved?.url || context?.parentURL !== import.meta.url) {
			recordPackageImport(context?.parentURL, resolved?.url);
			const stub = sharedRequireStub(context, resolved);
			if (stub !== null) return stub;
		}
		// One of slothlet's runtime entry files, which this copy evaluated through another loader: the importer is given
		// that module, unless it belongs to a second copy of slothlet Node loaded itself (#760).
		const url = resolved?.url;
		if (OWN_MODULES.has(url) && !NODE_LOADED.has(url) && !isOtherCopysFile(context?.parentURL)) {
			return { ...resolved, url: OWN_MODULE_PREFIX + url, format: "module" };
		}
		return resolved;
	},
	// Only instance-marked URLs are touched; every other load passes straight through, a CommonJS file's
	// source hash recorded on the way (#597).
	load: (url, context, nextLoad) => {
		// An instance's require() of a file no instance tags: the file's one module, from a stub that leaves Node's caches.
		if (url.startsWith(SHARED_REQUIRE_PREFIX)) {
			const target = url.slice(SHARED_REQUIRE_PREFIX.length);
			const ticket = mintTicket(null, (stub) => requireShared(target, stub));
			return {
				format: "commonjs",
				shortCircuit: true,
				source: `module.exports = ${STATE_REF}.redeem(${JSON.stringify(ticket)}).requireFromModule(${JSON.stringify(target)}, "commonjs", module);\n`
			};
		}
		// One of slothlet's runtime entry files, evaluated through another loader: the module that re-exports it (#760).
		if (url.startsWith(OWN_MODULE_PREFIX)) {
			return { format: "module", shortCircuit: true, source: ownModuleBridge(url.slice(OWN_MODULE_PREFIX.length)) };
		}
		// Node loading one of those files before this copy has evaluated it is loading this copy's own.
		if (SINGLE_COPY_FILES.includes(url) && !OWN_MODULES.has(url)) NODE_LOADED.add(url);
		if (url.includes(MARKER)) return loadInstanceModule(url, context, nextLoad);
		const result = nextLoad(url, context);
		if (url.startsWith("file:") && shouldRecordCommonJS(url, result)) recordLoadedSource(url, result);
		return result;
	}
});

/**
 * Whether Node loads a file as CommonJS, decided the way Node decides it: `.cjs` always; `.js` by the
 * nearest `package.json` `type` (the first one found ends the walk), and with no `type` by syntax
 * detection (the source compiles as a CommonJS function body). Used by the vite plugin, which sees
 * file ids rather than Node's resolved formats.
 * @param {string} filePath - Absolute file path.
 * @returns {boolean} True when the file is CommonJS.
 * @internal
 * @example
 * isCommonJSFile("/app/lib/state.cjs"); // true
 */
export function isCommonJSFile(filePath) {
	if (filePath.endsWith(".cjs")) return true;
	if (!filePath.endsWith(".js")) return false;
	const host = HOST;
	for (let dir = host.dirname(filePath); ; dir = host.dirname(dir)) {
		const manifest = host.join(dir, "package.json");
		if (host.exists(manifest)) {
			let type;
			try {
				type = host.parseJSON(host.readFile(manifest, "utf8"))?.type;
			} catch {
				// Malformed package.json: leave the file to the host's own loader, which reports it.
				return false;
			}
			if (type === "module" || type === "commonjs") return type === "commonjs";
			break;
		}
		if (host.dirname(dir) === dir || host.basename(dir) === "node_modules") break;
	}
	try {
		const source = host.readFile(filePath, "utf8").replace(/^#!.*/, "");
		host.compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"]);
		return true;
	} catch {
		return false;
	}
}

/**
 * The global key a host file's registration puts what it captures under (#714): an array of the `Error`s each of the
 * host's own files vite transformed created as its last statement, read by slothlet's frame placement.
 * @type {string}
 * @internal
 */
export const VITE_HOST_SCRIPTS = "@cldmv/slothlet.viteHostScripts";

/**
 * The global key the records of who loaded each of the host's own vite-transformed files go under (#714): the `Error`
 * each record's virtual module creates, frozen, its message the JSON of the importers, read by slothlet's frame placement.
 * @type {string}
 * @internal
 */
export const VITE_LOADED_BY = "@cldmv/slothlet.viteLoadedBy";

/**
 * The specifier of the virtual module that records who loaded a file (#714), before its `id` parameter: imported by the
 * statement the vite plugin appends to each of the host's own files, resolved by the plugin to the id with a leading
 * `\0`, which no file on disk can have.
 * @type {string}
 * @internal
 */
export const LOADED_BY_SPECIFIER = "virtual:slothlet-loaded-by?";

/**
 * The id an import of the virtual module that records who loaded a file resolves to when the plugin did not write that
 * import itself (#715): a module that records nothing. Without the `?` of {@link LOADED_BY_SPECIFIER}, so no record is
 * ever read from it.
 * @type {string}
 * @private
 */
const NO_RECORD_ID = "\0virtual:slothlet-loaded-by-none";

/**
 * The specifier of the virtual module the vite plugin has an instance module import {@link checkModuleImport} from.
 * @type {string}
 * @private
 */
const IMPORT_CHECK_SPECIFIER = "virtual:slothlet-import-check";

/**
 * The files of slothlet's own a host-file registration is never appended to: its source or build tree and the package's
 * entry files.
 * @type {string[]}
 * @private
 */
const OWN_TREE = [
	...OWN_PREFIXES,
	...[new URL("../../", import.meta.url)].filter((u) => u.protocol === "file:").map((u) => toSlashPath(u.href))
];

/**
 * A JavaScript or TypeScript ES module file name (`.js`, `.mjs`, `.ts`, `.mts`, `.jsx`, `.tsx`).
 * @type {RegExp}
 * @private
 */
const MODULE_FILE = /\.(?:m?[jt]sx?)$/;

/**
 * The registration the vite plugin appends to a file of the host's own (#714): one statement that pushes an `Error`
 * created by the file's own top-level code. Vite transforms the host's files, so their code never hashes as the files on
 * disk do; the `Error`'s stack, read once by slothlet, shows the script vite compiled the file into and the runner that
 * evaluated it, and slothlet takes that script as the file's own source only when the runner is vitest's or vite's own
 * code. After it, an import of the virtual module that records which modules loaded the file (see
 * {@link loadedBySource}); an import is evaluated before the file's own code, wherever it is written. Appended, so no
 * line of the file moves. Instance files, packages under `node_modules`, slothlet's own files, CommonJS, virtual modules
 * and files that are not JavaScript are left as they are.
 * @param {string} code - The file's code, already compiled to JavaScript.
 * @param {string} id - The module id.
 * @returns {{code: string, map: null}|null} The code with the registration appended, or null.
 * @private
 */
function hostScriptRegistration(code, id) {
	if (!isRegisteredFile(id)) return null;
	const loadedBy = `import ${JSON.stringify(LOADED_BY_SPECIFIER + new URLSearchParams({ id }).toString())};`;
	return { code: `${code}\n;${SCRIPT_REGISTRATION}\n${loadedBy}\n`, map: null };
}

/**
 * The statement that registers the script vite compiled a file into (#714): it pushes an `Error` the file's own
 * top-level code creates.
 * @type {string}
 * @private
 */
const SCRIPT_REGISTRATION = `(globalThis[Symbol.for(${JSON.stringify(VITE_HOST_SCRIPTS)})] ??= []).push(new Error());`;

/**
 * Whether the vite plugin appends a registration to a module id (#714): a JavaScript or TypeScript ES module file of
 * an absolute path, not under `node_modules`, not slothlet's own and not CommonJS.
 * @param {string} id - The module id.
 * @returns {boolean} True when it does.
 * @private
 */
function isRegisteredFile(id) {
	const [base] = splitQuery(id);
	const path = toSlashPath(base);
	if (!/^(?:\/|[a-z]:\/)/i.test(path) || !MODULE_FILE.test(path) || path.includes("/node_modules/")) return false;
	if (OWN_TREE.some((own) => path === own || path.startsWith(own.endsWith("/") ? own : `${own}/`))) return false;
	return !isCommonJSFile(path);
}

/**
 * The code of the virtual module that records who loaded a file (#714): one statement that creates an `Error`, freezes
 * it with the importers as its message, and pushes it. The plugin writes the code, from the imports it resolved, so no
 * file's code can say what it says; slothlet reads the file it is about from the frame of the `Error`, the virtual
 * module's own.
 * @param {Array<string>} importers - The ids of the modules recorded as loading the file.
 * @returns {string} The code.
 * @private
 */
function loadedBySource(importers) {
	const registry = `globalThis[Symbol.for(${JSON.stringify(VITE_LOADED_BY)})]`;
	return `const record = Object.freeze(new Error(${JSON.stringify(JSON.stringify(importers))}));\n(${registry} ??= []).push(record);\n`;
}

/**
 * Vite plugin applying the same rule inside a vite module graph — for leaves a consumer loads
 * through slothlet's `import` hook under vitest (docs/TESTING.md), where Node's resolve hooks
 * never see the leaf's imports. Add it to the consumer's `vitest.config` `plugins`.
 *
 * A CommonJS helper imported under an instance id (#534) is loaded as the same ES module wrapper the
 * Node load hook generates: the file runs through the instance's private CommonJS cache in the
 * test's own process, so its own `require()`s — CommonJS or ES module — are per instance too, and
 * the copy is shared with the instance's `.cjs` leaves.
 *
 * Every JavaScript or TypeScript ES module it transforms that is not under `node_modules` and not slothlet's own, an
 * instance file among them, gets one statement appended that records the script vite compiled it into (#714). Each such
 * file that is not an instance file also imports a virtual module that records which modules loaded it, as the plugin
 * resolved their imports: an instance file, or another file a module loaded. With permissions on, code running inside
 * a module's call is then attributed as it is under Node's own loader (docs/PERMISSIONS.md).
 * @returns {object} A vite plugin (`name`, `enforce`, `resolveId`, `transform`, `load`).
 * @public
 * @example
 * // vitest.config.mjs
 * import { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
 * export default defineConfig({ plugins: [slothletInstanceImports()] });
 */
export function slothletInstanceImports() {
	/**
	 * The files no instance tags that a module loaded (#714), by id: the ids of the modules that import each, an instance
	 * file or another file a module loaded.
	 * @type {Map<string, Set<string>>}
	 */
	const moduleImporters = new Map();
	/**
	 * Record that a module loaded a file no instance tags, of an absolute path and not slothlet's own.
	 * @param {object|null} resolved - What the import resolved to.
	 * @param {string} importer - The importing module's id.
	 * @returns {void}
	 */
	const noteModuleImport = (resolved, importer) => {
		if (!resolved || resolved.external || typeof resolved.id !== "string" || resolved.id.includes(MARKER)) return;
		const path = toSlashPath(splitQuery(resolved.id)[0]);
		if (!/^(?:\/|[a-z]:\/)/i.test(path) || OWN_TREE.some((own) => path === own || path.startsWith(own.endsWith("/") ? own : `${own}/`)))
			return;
		let importers = moduleImporters.get(resolved.id);
		if (!importers) moduleImporters.set(resolved.id, (importers = new Set()));
		importers.add(importer);
		// Through a file a module loaded, the modules that loaded it: a file under `node_modules` gets no record of its own.
		for (const through of moduleImporters.get(importer) ?? []) importers.add(through);
	};
	/**
	 * Whether a record of who loaded a file is one the plugin wrote (#715): a module's record of a file names that module
	 * as a loader only when the plugin resolved that module's import of the file, and a file's own record is only the
	 * file's own import of it (from the file, whatever query its id carries). Any module can write such an import itself;
	 * one the plugin did not write records nothing.
	 * @param {string} query - The record's parameters (`id`, and `by` for a module's record).
	 * @param {string|undefined} [importer] - The importing module's id, when resolving the import.
	 * @returns {boolean} True when the record is the plugin's own.
	 */
	const isOwnRecordQuery = (query, importer) => {
		const params = new URLSearchParams(query);
		const loaded = params.get("id");
		const by = params.get("by");
		if (loaded === null) return false;
		if (by !== null) return moduleImporters.get(loaded)?.has(by) === true;
		// vite hands `resolveId` the importer's file, without the query its id may carry.
		return importer === undefined || toSlashPath(importer) === toSlashPath(loaded);
	};
	/**
	 * {@link isOwnRecordQuery} for an import of the virtual module's specifier.
	 * @param {string} source - The specifier as written.
	 * @param {string|undefined} importer - The importing module's id.
	 * @returns {boolean} True when the record is the plugin's own.
	 */
	const isOwnRecord = (source, importer) =>
		typeof importer === "string" && isOwnRecordQuery(source.slice(LOADED_BY_SPECIFIER.length), importer);
	/**
	 * Whether an importer is a module's code (see {@link refuseInternalImport}): an instance file, or a file a module
	 * loaded that no instance tags, outside `node_modules` and outside slothlet's own files.
	 * @param {string} importer - The importing module's id.
	 * @returns {boolean} True for a module's code.
	 */
	const isModuleImporter = (importer) =>
		importer.includes(MARKER) ||
		moduleFiles.has(toSlashPath(importer)) ||
		(moduleImporters.has(importer) && !/\/node_modules\//.test(toSlashPath(importer)) && slothletCodePath(importer) === null);
	/**
	 * The files vite has loaded as an instance's copy, by path: vite names the importer of a dynamic `import()` by its
	 * file alone, without the query its id carries, so an import from one of these paths is a module's.
	 * @type {Set<string>}
	 */
	const moduleFiles = new Set();
	/**
	 * What the name an instance module imports the import check under ends with: one no module can know beforehand.
	 * @type {string}
	 */
	const checkName = HOST === null ? "0" : HOST.randomUUID().replace(/-/g, "");
	return {
		name: "slothlet-instance-imports",
		enforce: "pre",
		/**
		 * Resolve a relative/`file:` import of a slothlet leaf with the leaf's instance query, and record the files no
		 * instance tags that a module imports by such a specifier or through a file a module loaded (#714).
		 * @param {string} source - The specifier as written.
		 * @param {string|undefined} importer - The importing module's id.
		 * @param {object} [options] - Vite resolve options.
		 * @returns {Promise<object|string|null>} The resolution, or null to defer to other resolvers.
		 */
		async resolveId(source, importer, options) {
			if (typeof source === "string" && source.startsWith(LOADED_BY_SPECIFIER))
				return isOwnRecord(source, importer) ? `\0${source}` : NO_RECORD_ID;
			if (source === IMPORT_CHECK_SPECIFIER) return `\0${IMPORT_CHECK_SPECIFIER}`;
			if (typeof importer !== "string") return null;
			const tagged = importer.includes(MARKER);
			// Slothlet's own files are slothlet's: a module's code cannot import them, by any spelling that can reach them.
			if (isModuleImporter(importer) && (isFileSpecifier(source) || source.startsWith("@cldmv/slothlet") || source.startsWith("#"))) {
				const target = await this.resolve(source, importer, { ...options, skipSelf: true });
				if (target && !target.external && isSlothletInternal(target.id)) throw await viteImportRefusal(source, target.id);
			}
			// A file only the host loaded imports as vite resolves it.
			if (!tagged && !moduleImporters.has(importer)) return null;
			// A bare specifier an instance file imports that cannot name a file of its own package is recorded where the file
			// is transformed, below.
			if (tagged && !isFileSpecifier(source) && !mayNameOwnPackage(source, importer)) return null;
			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
			if (tagged && resolved && !resolved.external) {
				// A bare specifier into the instance file's own package (`#imports`, a self-reference) is tagged as a relative
				// import of the file is (#715).
				const id = propagateInstanceQuery(source, importer, resolved.id);
				if (id !== resolved.id) return { ...resolved, id };
			}
			// Any other bare specifier an instance file imports is recorded where the file is transformed.
			if (tagged && !isFileSpecifier(source)) return null;
			// A file a module loaded that no instance tags (a package's file, an import of a file a module loaded): who
			// loaded it is recorded, as Node's resolve hook records it.
			noteModuleImport(resolved, importer);
			return resolved;
		},
		/**
		 * Record an instance module's imports where the module runs. A vite module graph is resolved in the
		 * server, not in the process that evaluates the modules, so each instance ES module gets one statement
		 * appended that records the files it imports into that process's instance graph (see
		 * {@link instanceImporters}). Appended, so no line of the module moves.
		 */
		transform: {
			order: "post",
			/**
			 * @param {string} code - The module's code, already compiled to JavaScript.
			 * @param {string} id - The module id.
			 * @returns {Promise<object|null>} The code with the registration appended, or null.
			 */
			async handler(code, id) {
				if (typeof id !== "string") return null;
				if (!id.includes(MARKER)) return hostScriptRegistration(code, id);
				const [base, query = ""] = splitQuery(id);
				moduleFiles.add(toSlashPath(base));
				const instanceID = new URLSearchParams(query).get("slothlet_instance");
				if (instanceID === null || isCommonJSFile(base)) return null;
				// The script vite compiled an instance file into is registered too, so its code is told to be the file's own
				// under vitest as it is under Node's own loader (#714).
				const registration = isRegisteredFile(id) ? `\n;${SCRIPT_REGISTRATION}\n` : "";
				let ast;
				try {
					ast = this.parse(code);
				} catch {
					// Code this parser cannot read is left as it is; its imports go unrecorded.
					return registration ? { code: `${code}${registration}`, map: null } : null;
				}
				// Static imports and re-exports, and dynamic import() calls with a literal specifier anywhere in the module.
				const specifiers = new Set();
				const bare = new Set();
				// Each import() and import.meta.resolve() of the module, held as it runs (see checkModuleImport).
				const checked = [];
				const visit = (node) => {
					if (!node || typeof node !== "object") return;
					if (Arrays.isArray(node)) {
						for (const child of node) visit(child);
						return;
					}
					if (typeof node.type !== "string") return;
					if (node.type === "ImportExpression" && node.source) checked.push(node.source);
					else if (
						node.type === "CallExpression" &&
						node.callee?.type === "MemberExpression" &&
						node.callee.object?.type === "MetaProperty" &&
						node.callee.object.meta?.name === "import" &&
						node.callee.property?.name === "resolve"
					)
						checked.push(node);
					const isImport = /^(?:ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration|ImportExpression)$/.test(node.type);
					const source = isImport ? node.source?.value : undefined;
					if (typeof source === "string" && isFileSpecifier(source)) specifiers.add(source);
					else if (typeof source === "string") bare.add(source);
					for (const key of Objects.keys(node)) if (key !== "type") visit(node[key]);
				};
				visit(ast.body);
				// A file no instance tags that the module imports by a bare specifier (a linked package, its package's own
				// `#imports`) is recorded as the module's (#714). A specifier computed at run time is not seen here.
				// The files no instance tags that the module imports, of those the plugin registers: each gets a record of its
				// own naming this module as a loader (#715). The record a file's own registration imports is written once, when
				// vite first loads it, so a module importing the file after that would go unrecorded.
				const shared = new Set();
				const noteShared = (resolved) => {
					if (!resolved || resolved.external || typeof resolved.id !== "string" || resolved.id.includes(MARKER)) return;
					noteModuleImport(resolved, id);
					if (isRegisteredFile(resolved.id)) shared.add(resolved.id);
				};
				const children = [];
				for (const specifier of [...bare, ...specifiers]) {
					const resolved = await this.resolve(specifier, id);
					if (resolved && !resolved.external && resolved.id.includes(MARKER)) children.push(resolved.id);
					else noteShared(resolved);
				}
				const loadedBy = [...shared]
					.map((child) => `\nimport ${JSON.stringify(LOADED_BY_SPECIFIER + new URLSearchParams({ id: child, by: id }).toString())};`)
					.join("");
				const imports = children.length
					? `\n;globalThis[Symbol.for(${JSON.stringify(STATE.description)})]?.recordImports?.(${JSON.stringify(instanceID)}, ${JSON.stringify(id)}, ${JSON.stringify(children)});`
					: "";
				// The check is imported under a name the module cannot know, at the end so no line moves (imports are hoisted).
				let body = code;
				let check = "";
				if (checked.length) {
					const name = `__slothlet_import_check_${checkName}`;
					for (const node of checked.sort((a, b) => b.start - a.start))
						body = `${body.slice(0, node.start)}${name}(${body.slice(node.start, node.end)}, import.meta.url)${body.slice(node.end)}`;
					check = `\nimport { checkImport as ${name} } from ${JSON.stringify(IMPORT_CHECK_SPECIFIER)};`;
				}
				const tail = `${registration}${loadedBy}${imports}${check}`;
				return tail || body !== code ? { code: `${body}${tail}\n`, map: null } : null;
			}
		},
		/**
		 * Load a CommonJS helper carrying an instance query as its per-instance ES module wrapper, a JSON file carrying one
		 * as Node loads a JSON module, and the virtual module that records which modules loaded a file (#714), from the
		 * imports resolved so far.
		 * @param {string} id - The module id.
		 * @returns {object|null} The module's code, or null to defer to vite's own loading.
		 */
		load(id) {
			if (id === NO_RECORD_ID) return { code: "export {};\n", map: null };
			// Read once, as the module importing it loads, from the shared object that module's own code cannot replace.
			if (id === `\0${IMPORT_CHECK_SPECIFIER}`) return { code: `export const checkImport = ${STATE_REF}.checkImport;\n`, map: null };
			if (typeof id === "string" && id.startsWith(`\0${LOADED_BY_SPECIFIER}`)) {
				const query = id.slice(1 + LOADED_BY_SPECIFIER.length);
				// A record the plugin did not resolve a module's import of the file for records nothing (#715).
				if (!isOwnRecordQuery(query)) return { code: "export {};\n", map: null };
				const params = new URLSearchParams(query);
				const by = params.get("by");
				// A module's own record of a file it imports (#715) names that module and the modules that loaded it; a file's
				// own record, the importers resolved so far.
				const importers = by === null ? (moduleImporters.get(params.get("id")) ?? []) : [by, ...(moduleImporters.get(by) ?? [])];
				return { code: loadedBySource([...importers]), map: null };
			}
			if (typeof id !== "string" || !id.includes(MARKER)) return null;
			const [base, query = ""] = splitQuery(id);
			const instanceID = new URLSearchParams(query).get("slothlet_instance");
			if (instanceID === null) return null;
			// A JSON file a leaf imports carries the instance query, as under Node; vite loads no JSON file under a query of
			// its own, so it is loaded here, as Node loads a JSON module: its value as the default export (#714).
			if (/\.json$/i.test(toSlashPath(base)))
				return { code: `export default ${JSON.stringify(JSON.parse(nodeBuiltin("node:fs").readFileSync(base, "utf8")))};\n`, map: null };
			if (!isCommonJSFile(base)) return null;
			const params = new URLSearchParams(query);
			return { code: commonJSWrapperSource(base, instanceID, null, helperCopyImporter(params), params.get(HELPERS_MOUNT_PARAM)) };
		}
	};
}
