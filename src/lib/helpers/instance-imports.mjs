/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/instance-imports.mjs
 *	@Date: 2026-09-28T20:32:55-07:00 (1790652775)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:50-08:00 (1794882530)
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
	appendList,
	ArrayBuffer,
	ArrayBuffers,
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	decodeURIComponent,
	Error,
	filterList,
	FunctionMethods,
	JSON,
	listPush,
	listSplice,
	listUnshift,
	Map,
	mapEntries,
	mapKeys,
	mapKeysToArray,
	mapList,
	MapMethods,
	mapValues,
	NativeProxy,
	Objects,
	Processes,
	Reflect,
	RegExpMethods,
	regExpReplace,
	regExpSearch,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	splitText,
	String,
	StringMethods,
	Symbol,
	SymbolMethods,
	Symbols,
	TextDecoder,
	TextDecoderMethods,
	TypeError,
	URL,
	URLMethods,
	URLSearchParams,
	URLSearchParamsMethods,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { readStack, stackText, unreadError } from "#helpers/stack-read";

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
const STATE_REF = `globalThis[Symbol.for(${JSON.stringify(SymbolMethods.description(STATE))})]`;

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
 * file whose own copies are served, under `helpers: "module"`; `fresh` when the anchor is loaded as a leaf), else null.
 * @type {{ instanceID: string, anchor: string, importer?: string|null, mount?: string|null, fresh?: boolean }|null}
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
 * The random value each script key's sources are sealed with (see {@link sealLoadedSource}), drawn the first time a
 * file loads under the key and kept with its sources, so a source loaded again is the same script.
 * @type {Map<string, string>}
 * @private
 */
const SEALS = new Map();

/**
 * The CommonJS sources an instance's scope loads that are no leaf's own load (see {@link scopeLoadKind}), by script key,
 * the newest {@link SCRIPTS_PER_KEY} each: a helper file, and a leaf's file a sibling api file requires itself, which
 * is a helper of that sibling's, before or after slothlet loads the leaf. Frame placement holds a frame at a leaf's file
 * running one of these to the files that import it, as a helper file's code. Kept apart from {@link LOADED_SCRIPTS},
 * so the leaf's own loads stay listed however many of these load.
 * @type {Map<string, Array<string>>}
 * @private
 */
const HELPER_SCRIPTS = new Map();

/**
 * The random value each script key's helper loads are sealed with (see {@link HELPER_SCRIPTS}): another value than the
 * key's own loads take, so a helper load of a leaf's file is never the leaf's script.
 * @type {Map<string, string>}
 * @private
 */
const HELPER_SEALS = new Map();

/**
 * Who loaded each file no instance tags, as this copy's resolve hook saw it resolved (#597): by the file's path (forward
 * slashes, no query, the real path Node resolves to), the URLs of the files that import it — a module's instance copy
 * with its tags, a package file, the host's own — and, when the named importer is a file nothing loaded through the
 * hook, of the module's instance copy whose code was running when the file was resolved (a `require` it made through
 * `createRequire` of any path). Kept here, out of every
 * module's reach, and read through the frozen reader on the shared object (see {@link SCRIPTS_READER}): whose code
 * an untagged file's code is, under `permissions.caller.provenance`. A file loaded before slothlet's hook was registered has
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
 * The current stack as text in V8's own frame format (`    at …` lines under an `Error` line), read with slothlet's
 * own formatter whatever the global `Error` and its stack settings hold (see {@link readStack}).
 * @param {number} limit - The most frames to read.
 * @returns {string} The stack.
 * @throws {TypeError} When the stack cannot be read with slothlet's own formatter: what it would decide is refused.
 * @private
 */
function ownStackText(limit) {
	const read = readStack(stackText, { limit });
	if (read === null) throw new TypeError("slothlet could not read the call stack with its own formatter, so the load is refused.");
	return String(read.value ?? read.text);
}

/**
 * The innermost module instance copy on the stack (see {@link TAGGED_FRAME}), read from the whole stack in V8's own
 * format: Node's loader frames between a module's `require()` and the resolve hook can run past a host's
 * `Error.stackTraceLimit` (Node 22's CommonJS loader puts more than ten there).
 * @returns {string|undefined} The module's copy, or undefined when none is on the stack.
 * @private
 */
function runningTaggedFrame() {
	return RegExpMethods.exec(TAGGED_FRAME, ownStackText(Infinity))?.[1];
}

/**
 * An untagged file's key in {@link PACKAGE_IMPORTERS}: its path with forward slashes and no query, a Windows drive
 * spelled as a stack frame spells it.
 * @param {string} url - The file's URL or path.
 * @returns {string} The key.
 * @private
 */
function packageKey(url) {
	return regExpReplace(/^\/([a-z]:\/)/i, toSlashPath(url), "$1");
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
	if (typeof url !== "string" || !StringMethods.startsWith(url, "file:") || StringMethods.includes(url, MARKER)) return;
	const loaders = [];
	const parent = typeof parentURL === "string" && StringMethods.startsWith(parentURL, "file:") ? parentURL : null;
	if (parent) listPush(loaders, parent);
	// Named as imported by a file nothing loaded through the hook (`createRequire` of any path, a host file loaded
	// before it): the module whose code is running loaded it. A module's own import, or one of a file the hook saw
	// loaded, keeps to its importer, so a module that merely triggers another's lazy load takes none of its files.
	if (!parent || (!StringMethods.includes(parent, MARKER) && !MapMethods.has(PACKAGE_IMPORTERS, packageKey(parent)))) {
		const running = runningTaggedFrame();
		if (running) listPush(loaders, running);
	}
	if (!loaders.length) return;
	const key = packageKey(url);
	let importers = MapMethods.get(PACKAGE_IMPORTERS, key);
	if (!importers) MapMethods.set(PACKAGE_IMPORTERS, key, (importers = new Set()));
	for (let ofIndex = 0, ofList = loaders; ofIndex < ofList.length; ofIndex++) {
		const loader = ofList[ofIndex];
		SetMethods.add(importers, loader);
	}
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
 * Node's CommonJS loader (`Module._load`, `Function._load` on Node 22) is reached on the stack before the `require` function Node hands each module
 * (a `require.resolve()` reaches that function first), and the `require` is made from an instance copy's URL, from one
 * of an instance's CommonJS files (the `require` Node hands that file), or while such a copy's code runs.
 * @param {string} parentURL - The requiring file's URL.
 * @param {boolean} [commonJSParent=false] - Whether the requiring file is one of an instance's CommonJS files.
 * @returns {boolean} True for such a `require()`.
 * @private
 */
function isInstanceRequireLoad(parentURL, commonJSParent = false) {
	const lines = splitText(ownStackText(Infinity), "\n");
	let at = -1;
	for (let i = 0; i < lines.length && at === -1; i++) {
		if (StringMethods.includes(lines[i], "(node:internal/modules/helpers:")) return false;
		// Node 22 names the loader's frame `Function._load`, later versions `Module._load`.
		if (RegExpMethods.exec(/^\s*at (?:Module|Function)\._load \(node:/, lines[i]) !== null) at = i;
	}
	if (at === -1) return false;
	// The hook is answering that `require()` itself: between it and the loader's frame run only Node's own frames and
	// slothlet's (a resolution asked for by other code that a `require()` further out is running is not one).
	for (let i = 1; i < at; i++) {
		const location = frameLocation(lines[i]);
		if (location !== null && !StringMethods.startsWith(location, "node:") && slothletCodePath(location) === null) return false;
	}
	return (
		commonJSParent ||
		StringMethods.includes(parentURL, MARKER) ||
		ArrayMethods.some(copyList(lines, at + 1), (line) => RegExpMethods.exec(INSTANCE_FRAME, line) !== null)
	);
}

/**
 * Whether a file no instance tags is one of an instance's CommonJS files: an api file or helper the CommonJS scope that
 * is loading holds, or one an instance's CommonJS cache keeps (see {@link COMMONJS_READER}). Such a file runs under its
 * plain path, so its URL carries no instance query.
 * @param {string} ref - The file's URL or path.
 * @returns {boolean} True for such a file.
 * @private
 */
function isInstanceCommonJSFile(ref) {
	if (StringMethods.includes(ref, MARKER)) return false;
	const key = packageKey(ref);
	if (ACTIVE !== null && (key === packageKey(ACTIVE.anchor) || isInstanceScopedFile(key, ACTIVE.anchor))) return true;
	for (const instanceID of mapKeys(SCOPE_KEYS))
		if (ArrayMethods.some(COMMONJS_READER.files(instanceID), (file) => packageKey(file) === key)) return true;
	return false;
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
 * `require()` reaches the hook and is recorded. The same holds for a file of another package that an instance's
 * CommonJS files require, while they load or later: Node answers the second file's `require` of the package from its
 * caches too. A `require.resolve()` still answers the file's path, and a `require()` slothlet's own files make, or one
 * of the CommonJS scope's own files made while a CommonJS api file loads (the scope's cache serves those, and they are
 * recorded from Node's own list, see {@link recordScopeRequires}), is left as it is.
 * Only a `require()` whose importer is an instance copy, one of an instance's CommonJS files, or one the resolve hook
 * has seen nothing load (the path a `require` was made from), is looked at.
 * @param {object} context - Node's resolve context.
 * @param {ResolveResult} resolved - The resolution.
 * @returns {ResolveResult|null} The stub's resolution, or null.
 * @private
 */
function sharedRequireStub(context, resolved) {
	const url = resolved?.url;
	const parentURL = context?.parentURL;
	if (
		typeof url !== "string" ||
		!StringMethods.startsWith(url, "file:") ||
		StringMethods.includes(url, "?") ||
		RegExpMethods.exec(/\.(?:json|node)$/, url) !== null
	)
		return null;
	if (typeof parentURL !== "string" || !StringMethods.startsWith(parentURL, "file:") || !hasCondition(context?.conditions, "require"))
		return null;
	const own = (ref) => {
		const path = toSlashPath(ref);
		return ArrayMethods.some(
			OWN_TREE,
			(dir) => path === dir || StringMethods.startsWith(path, StringMethods.endsWith(dir, "/") ? dir : `${dir}/`)
		);
	};
	if (own(parentURL) || own(url)) return null;
	// An instance's CommonJS file requiring a file of another package; while a CommonJS api file loads, only that.
	const commonJSParent = isInstanceCommonJSFile(parentURL) && !isInstanceScopedFile(url, parentURL);
	if (ACTIVE !== null && !commonJSParent) return null;
	if (!StringMethods.includes(parentURL, MARKER) && !commonJSParent && MapMethods.has(PACKAGE_IMPORTERS, packageKey(parentURL)))
		return null;
	if (!isInstanceRequireLoad(parentURL, commonJSParent)) return null;
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
	const requireFn = NODE.module.createRequire(import.meta.url);
	const cache = requireFn.cache;
	for (let ofIndex = 0, ofList = [stub?.id, stub?.filename]; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (typeof key === "string" && cache[key] === stub) delete cache[key];
	}
	const outer = SERVING;
	SERVING = url;
	try {
		return requireFn(NODE.url.fileURLToPath(url));
	} finally {
		SERVING = outer;
	}
}

/**
 * The reader of {@link LOADED_SCRIPTS} on the shared object: whether a key has sources recorded and whether a given
 * one is among them (and whether it is one of the key's helper loads, see {@link HELPER_SCRIPTS}), a copy of them, how many keys have any, and the files importing a package file (see
 * {@link PACKAGE_IMPORTERS}). Nothing it offers adds or drops a source or an import, so a module reaching the shared
 * object cannot have code it compiled under another file's name taken for that file (#597). Only the copy that
 * recorded them drops an instance's, when it shuts down.
 * @type {{lookup: Function, hashes: Function, text: Function, count: Function, packageImporters: Function}}
 * @private
 */
const SCRIPTS_READER = Objects.freeze({
	lookup: (key, hash) => {
		const hashes = MapMethods.get(LOADED_SCRIPTS, key);
		const helpers = MapMethods.get(HELPER_SCRIPTS, key);
		const helper = hash !== undefined && Boolean(helpers == null ? undefined : ArrayMethods.includes(helpers, hash));
		return {
			known: Boolean(hashes?.length || helpers?.length),
			has: helper || (hash !== undefined && Boolean(hashes == null ? undefined : ArrayMethods.includes(hashes, hash))),
			helper
		};
	},
	hashes: (key) => concatLists(MapMethods.get(LOADED_SCRIPTS, key) ?? [], MapMethods.get(HELPER_SCRIPTS, key) ?? []),
	text: (key, hash) => {
		const texts = MapMethods.get(LOADED_TEXTS, key);
		if (!texts) return undefined;
		if (hash !== undefined && hash !== null) return MapMethods.get(texts, hash);
		// No hash to go by (an engine that reports none): the newest source loaded under the key, its own loads first.
		const newest =
			(MapMethods.get(LOADED_SCRIPTS, key) == null ? undefined : ArrayMethods.at(MapMethods.get(LOADED_SCRIPTS, key), -1)) ??
			(MapMethods.get(HELPER_SCRIPTS, key) == null ? undefined : ArrayMethods.at(MapMethods.get(HELPER_SCRIPTS, key), -1));
		return newest === undefined ? undefined : MapMethods.get(texts, newest);
	},
	count: () => SetMethods.size(setFrom(concatLists(mapKeysToArray(LOADED_SCRIPTS), mapKeysToArray(HELPER_SCRIPTS)))),
	packageImporters: (path) => setToArray(MapMethods.get(PACKAGE_IMPORTERS, packageKey(path)))
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
	let graph = MapMethods.get(IMPORT_GRAPHS, instanceID);
	if (!graph) {
		graph = new Map();
		MapMethods.set(IMPORT_GRAPHS, instanceID, graph);
	}
	const parentPath = toSlashPath(parent);
	for (let ofIndex = 0, ofList = children; ofIndex < ofList.length; ofIndex++) {
		const child = ofList[ofIndex];
		if (typeof child !== "string") continue;
		const childPath = toSlashPath(child);
		let parents = MapMethods.get(graph, childPath);
		if (!parents) {
			parents = new Set();
			MapMethods.set(graph, childPath, parents);
		}
		const before = SetMethods.size(parents);
		SetMethods.add(parents, parentPath);
		// Counted on the graph, so a reader can tell it changed without walking it.
		if (SetMethods.size(parents) !== before) graph.edges = (graph.edges ?? 0) + 1;
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
			return MapMethods.size(graph);
		},
		has: (file) => MapMethods.has(graph, file),
		get: (file) => {
			const importers = MapMethods.get(graph, file);
			return importers ? setFrom(setToArray(importers)) : undefined;
		},
		keys: () => ArrayMethods.values(mapKeysToArray(graph)),
		*[Symbol.iterator]() {
			for (const ofEntry of mapEntries(graph)) {
				const file = ofEntry[0],
					importers = ofEntry[1];
				yield [file, setToArray(importers)];
			}
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
		const graph = MapMethods.get(IMPORT_GRAPHS, instanceID);
		if (!graph) return null;
		let view = MapMethods.get(GRAPH_VIEWS, instanceID);
		if (!view) MapMethods.set(GRAPH_VIEWS, instanceID, (view = graphView(graph)));
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
		const scope = MapMethods.get(SCOPES, instanceID);
		const files = concatLists(mapKeysToArray(scope), setToArray(MapMethods.get(LEAVES, instanceID)));
		// The copies kept per importing api file (`helpers: "module"`).
		for (const copies of mapValues(MapMethods.get(COPIES, instanceID))) appendList(files, mapKeysToArray(copies));
		return files;
	},
	version: (instanceID) => {
		const key = MapMethods.get(SCOPE_KEYS, instanceID);
		if (!key) return null;
		const scoped = MapMethods.get(SCOPES, instanceID);
		const leaves = MapMethods.get(LEAVES, instanceID);
		let count = (scoped ? MapMethods.size(scoped) : 0) + (leaves ? SetMethods.size(leaves) : 0);
		for (const held of mapValues(MapMethods.get(COPIES, instanceID))) count += MapMethods.size(held);
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
		own: (url) => MapMethods.get(OWN_MODULES, url),
		claim: claimHere,
		hooks: () => installInstanceImportHooks(NODE_MODULE),
		redeem: redeemTicket,
		requireCJS: requireCJSFromRunner,
		checkImport: checkModuleImport
	});
	Objects.defineProperty(globalThis, STATE, { __proto__: null, value: OWN_STATE, enumerable: false, configurable: false, writable: false });
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
 * The members of Node's built-in modules this file calls after it has loaded, taken when it loads (before any api
 * file runs) and kept in frozen holders, so code that replaces `fs.readFileSync`, `module.createRequire` or
 * `url.fileURLToPath` later does not run inside slothlet's loading. Read through `process.getBuiltinModule()`, so this
 * module has no static `node:` import (it is also loaded by browser bundles and by vite configs). Null where no Node
 * builtins are available (a browser bundle), where none of the code calling them runs.
 * @type {{module: {createRequire: Function, registerHooks: Function|undefined, Module: Function}, url: {fileURLToPath: Function, pathToFileURL: Function}, fs: {readFileSync: Function}, nodeModule: object}|null}
 * @private
 */
const NODE = (() => {
	const getBuiltinModule = Processes.getBuiltinModule;
	if (typeof getBuiltinModule !== "function") return null;
	const nodeModule = getBuiltinModule("node:module");
	const url = getBuiltinModule("node:url");
	const fs = getBuiltinModule("node:fs");
	return Objects.freeze({
		module: Objects.freeze({ createRequire: nodeModule.createRequire, registerHooks: nodeModule.registerHooks, Module: nodeModule.Module }),
		url: Objects.freeze({ fileURLToPath: url.fileURLToPath, pathToFileURL: url.pathToFileURL }),
		fs: Objects.freeze({ readFileSync: fs.readFileSync }),
		nodeModule
	});
})();

/**
 * The members of a `node:module` this file calls when it registers its hooks: the ones taken at load (see
 * {@link NODE}) when it is the process's own, else the object's own (a caller's stand-in, under test).
 * @param {object} nodeModule - The `node:module` namespace or a stand-in.
 * @returns {{createRequire: Function, registerHooks: Function|undefined, Module: Function}} Its members.
 * @private
 */
function moduleMembers(nodeModule) {
	if (NODE !== null && nodeModule === NODE.nodeModule) return NODE.module;
	return { createRequire: nodeModule?.createRequire, registerHooks: nodeModule?.registerHooks, Module: nodeModule?.Module };
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
	const getBuiltinModule = Processes.getBuiltinModule;
	if (typeof getBuiltinModule !== "function") return null;
	const fs = getBuiltinModule("node:fs");
	const path = getBuiltinModule("node:path");
	const vm = getBuiltinModule("node:vm");
	const crypto = getBuiltinModule("node:crypto");
	const createHash = crypto.createHash;
	const hashPrototype = Objects.getPrototypeOf(Reflect.apply(createHash, crypto, ["sha256"]));
	const update = hashPrototype.update;
	const digest = hashPrototype.digest;
	const Decoder = TextDecoder;
	const decode = Decoder.prototype.decode;
	return Objects.freeze({
		randomUUID: FunctionMethods.bind(crypto.randomUUID, crypto),
		// What a loaded script is recorded under (see recordLoadedSource): the hash and the decoding are the ones in place
		// when slothlet loaded, as frame placement's are, so replacing `crypto` or `TextDecoder` later changes neither.
		sha256: (text) => {
			const hash = Reflect.apply(createHash, crypto, ["sha256"]);
			Reflect.apply(update, hash, [text, "utf8"]);
			return Reflect.apply(digest, hash, ["hex"]);
		},
		decode: (bytes) => Reflect.apply(decode, new Decoder(), [bytes]),
		readFile: FunctionMethods.bind(fs.readFileSync, fs),
		exists: FunctionMethods.bind(fs.existsSync, fs),
		dirname: FunctionMethods.bind(path.dirname, path),
		join: FunctionMethods.bind(path.join, path),
		basename: FunctionMethods.bind(path.basename, path),
		compileFunction: FunctionMethods.bind(vm.compileFunction, vm),
		parseJSON: JSON.parse
	});
})();

/**
 * `node:module` as it was when this module loaded, for the hooks another slothlet copy asks this one to register.
 * Null where no Node builtins are available.
 * @type {object|null}
 * @private
 */
const NODE_MODULE = typeof Processes.getBuiltinModule === "function" ? Processes.getBuiltinModule("node:module") : null;

/**
 * `module.stripTypeScriptTypes`, as it was when slothlet loaded (undefined on a Node without it): what a TypeScript
 * file's source is recorded as (see {@link recordLoadedSource}), so replacing it later does not change the record.
 * @type {Function|undefined}
 * @private
 */
const STRIP_TYPESCRIPT_TYPES = NODE_MODULE?.stripTypeScriptTypes;

/**
 * Slothlet's own files, as forward-slash paths: the `lib/` tree (`src/lib/` or `dist/lib/`) and the
 * package's two entry files. Imports resolving here are never duplicated per instance.
 * @type {string[]}
 * @private
 */
const OWN_PREFIXES = mapList(
	filterList(
		[new URL("../", import.meta.url), new URL("../../../index.mjs", import.meta.url), new URL("../../../index.cjs", import.meta.url)],
		(u) => URLMethods.protocol(u) === "file:"
	),
	(u) => toSlashPath(URLMethods.href(u))
);

/**
 * Slothlet's runtime entry files, as `file:` URLs: the modules an api file imports `self`, `context` and `instanceID`
 * from. Each is one module per process whichever loader is asked for it (#760).
 * @type {string[]}
 * @private
 */
const SINGLE_COPY_FILES = mapList(
	filterList(
		[
			new URL("../runtime/runtime.mjs", import.meta.url),
			new URL("../runtime/runtime-asynclocalstorage.mjs", import.meta.url),
			new URL("../runtime/runtime-livebindings.mjs", import.meta.url)
		],
		(u) => URLMethods.protocol(u) === "file:"
	),
	(u) => URLMethods.href(u)
);

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
 * Virtual-module prefix: `slothlet-self:<instanceID>|<url>` is the module an instance's file is given for one of
 * {@link SINGLE_COPY_FILES} (#803): it re-exports the runtime file, with a `self` of the form the instance's api root
 * takes (see {@link selfModuleSource}).
 * @type {string}
 * @private
 */
const SELF_PREFIX = "slothlet-self:";

/**
 * The two forms of `self` each runtime entry file made, by the file's URL and by its namespace (#803): `object` (an
 * object target, for an api whose root is an object) and `callable` (a bound function's target, for an api whose root
 * is a function), and the setter of the file's own `self` binding.
 * @type {Map<string|object, {object: object, callable: Function, bind: function(object): void}>}
 * @private
 */
const SELF_FORMS = new Map();

/**
 * Whether each instance's api root is a function, by instance ID (#803), as the instance's `api` took it when it was
 * first built: the form of `self` its files are given.
 * @type {Map<string, boolean>}
 * @private
 */
const SELF_KINDS = new Map();

/**
 * The setters of the `self` bindings each instance's files were given, by instance ID, then by runtime file URL
 * (#803): each is called again when the instance's form is set.
 * @type {Map<string, Map<string, Set<function(object): void>>>}
 * @private
 */
const SELF_BINDINGS = new Map();

/**
 * The api root an instance's host closed (`Object.preventExtensions`, `Object.seal`, `Object.freeze`), by instance ID,
 * with the form of `self` its files are given from then on, per runtime file URL (#827): see {@link closeInstanceSelf}.
 * @type {Map<string, {target: object|Function, forms: Map<string, object>}>}
 * @private
 */
const SELF_CLOSED = new Map();

/**
 * The form of `self` an instance's files are given for one runtime file once the instance's api root is closed (#827):
 * a Proxy over the closed root's own target, whose every operation goes through the runtime file's form of `self` (so
 * each read and change is decided as through `self` before), and which answers what the language requires of a closed
 * object (`Object.isExtensible`, the keys it lists, each member it holds fixed, its prototype) as the closed root does.
 * `Object.isExtensible`, `Object.isSealed` and `Object.isFrozen` of `self` then answer as they do of the host's `api`.
 * @param {object|Function} form - The runtime file's form of `self` for the instance's kind of root.
 * @param {object|Function} target - The closed root's own target.
 * @returns {object|Function} The form.
 * @private
 */
function closedSelfForm(form, target) {
	// What the target holds fixed, as the closed root reports it: a value or accessor it may no longer change is the
	// target's; one it holds writable is the one read through `self`, as the language lets a closed object answer.
	const describe = (prop, described) => {
		const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
		if (!fixed) return described === undefined ? undefined : { __proto__: null, ...described, configurable: true };
		if (fixed.configurable)
			return described === undefined
				? { ...fixed, ...("value" in fixed ? { value: undefined } : {}) }
				: { __proto__: null, ...described, configurable: true };
		if (!("value" in fixed) || !fixed.writable) return fixed;
		return { __proto__: null, ...fixed, value: described && "value" in described ? described.value : undefined };
	};
	return new NativeProxy(target, {
		get(t, prop) {
			const value = Reflect.get(form, prop);
			const fixed = Reflect.getOwnPropertyDescriptor(t, prop);
			return fixed && !fixed.configurable && "value" in fixed && !fixed.writable ? fixed.value : value;
		},
		has: (t, prop) => Reflect.has(form, prop) || Reflect.getOwnPropertyDescriptor(t, prop) !== undefined,
		ownKeys: (t) => {
			const keys = Reflect.ownKeys(form);
			return Reflect.isExtensible(t) ? keys : Reflect.ownKeys(t);
		},
		getOwnPropertyDescriptor: (_, prop) => describe(prop, Reflect.getOwnPropertyDescriptor(form, prop)),
		defineProperty: (_, prop, descriptor) => Reflect.defineProperty(form, prop, descriptor),
		deleteProperty: (_, prop) => Reflect.deleteProperty(form, prop),
		set: (_, prop, value) => Reflect.set(form, prop, value),
		getPrototypeOf: (t) => (Reflect.isExtensible(t) ? Reflect.getPrototypeOf(form) : Reflect.getPrototypeOf(t)),
		setPrototypeOf: (t, prototype) =>
			Reflect.setPrototypeOf(form, prototype) || (!Reflect.isExtensible(t) && Reflect.getPrototypeOf(t) === prototype),
		// Closing `self` is decided as closing it was; a root already closed is closed, as closing it again answers.
		preventExtensions: (t) => {
			Reflect.preventExtensions(form);
			return !Reflect.isExtensible(t);
		},
		apply: (_, thisArg, args) => Reflect.apply(form, thisArg, args),
		construct: (_, args) => Reflect.construct(form, args)
	});
}

/**
 * The form of `self` an instance's files are given for one runtime file now: its closed form once its root is closed
 * (see {@link closeInstanceSelf}), and otherwise the form of its kind of root.
 * @param {string} instanceID - The instance.
 * @param {string} url - The runtime file's URL.
 * @returns {object|Function|undefined} The form, or undefined when the runtime file made none.
 * @private
 */
function instanceSelfForm(instanceID, url) {
	const forms = MapMethods.get(SELF_FORMS, url);
	if (!forms) return undefined;
	const form = MapMethods.get(SELF_KINDS, instanceID) ? forms.callable : forms.object;
	const closed = MapMethods.get(SELF_CLOSED, instanceID);
	if (!closed) return form;
	let made = MapMethods.get(closed.forms, url);
	if (made === undefined) MapMethods.set(closed.forms, url, (made = closedSelfForm(form, closed.target)));
	return made;
}

/**
 * Give an instance's files a `self` closed as its api root now is (#827), once the host closed the root: every `self`
 * binding already given to its files, and each given later, takes the closed form (see {@link closedSelfForm}). The
 * runtime files' own `self` exports, which every instance shares, stay open.
 * @param {string} instanceID - The instance.
 * @param {object|Function} target - The closed root's own target.
 * @returns {void}
 * @internal
 */
function closeInstanceSelf(instanceID, target) {
	if (typeof instanceID !== "string" || target === null || (typeof target !== "object" && typeof target !== "function")) return;
	if (MapMethods.get(SELF_CLOSED, instanceID)?.target === target) return;
	MapMethods.set(SELF_CLOSED, instanceID, { target, forms: new Map() });
	for (const ofEntry of mapEntries(MapMethods.get(SELF_BINDINGS, instanceID))) {
		const url = ofEntry[0],
			setters = ofEntry[1];
		const form = instanceSelfForm(instanceID, url);
		if (form) for (const set of setValues(setters)) set(form);
	}
}

/**
 * Record the two forms of `self` one of slothlet's runtime entry files made (#803), and the setter of its own `self`
 * export. Called by each of those files once, before {@link registerOwnModule}. The file's own `self` is given the form
 * every running instance's root shares (see {@link sharedSelfCallable}).
 * @param {string} url - The file's `import.meta.url`.
 * @param {object} namespace - Its module namespace.
 * @param {{object: object, callable: Function}} forms - The two forms.
 * @param {function(object): void} bind - Sets the file's own `self` export.
 * @returns {void}
 * @internal
 * @example
 * registerSelfForms(import.meta.url, runtimeNamespace, { object: objectSelf, callable: callableSelf }, (v) => (self = v));
 */
function registerSelfForms(url, namespace, forms, bind) {
	if (MapMethods.has(SELF_FORMS, url)) return;
	const entry = Objects.freeze({ object: forms.object, callable: forms.callable, bind });
	MapMethods.set(SELF_FORMS, url, entry);
	MapMethods.set(SELF_FORMS, namespace, entry);
	bind(sharedSelfCallable() ? entry.callable : entry.object);
}

/**
 * The callable form of `self` the runtime entry file with this namespace made (#803), or null.
 * @param {object} namespace - The runtime file's namespace.
 * @returns {Function|null} Its callable form.
 * @internal
 */
function callableSelfOf(namespace) {
	return MapMethods.get(SELF_FORMS, namespace)?.callable ?? null;
}

/**
 * Whether the `self` a runtime file exports to code no instance's own (the host's code, a page's leaves, which a
 * browser loads without a resolve hook) takes the callable form (#803): when every instance running has a function
 * root. With none running, or roots of both kinds, it is the object form.
 * @returns {boolean} True for the callable form.
 * @private
 */
function sharedSelfCallable() {
	if (MapMethods.size(SELF_KINDS) === 0) return false;
	for (const callable of mapValues(SELF_KINDS)) if (!callable) return false;
	return true;
}

/**
 * Give each runtime file's own `self` export the form {@link sharedSelfCallable} names.
 * @returns {void}
 * @private
 */
function rebindSharedSelf() {
	const callable = sharedSelfCallable();
	for (const ofEntry of mapEntries(SELF_FORMS)) {
		const key = ofEntry[0],
			entry = ofEntry[1];
		// Each entry binds itself (its own `bind`).
		if (typeof key === "string") FunctionMethods.call(entry.bind, entry, callable ? entry.callable : entry.object);
	}
}

/**
 * Set the form of `self` an instance's files are given (#803): the callable form when its `api` is a function, the
 * object form otherwise. Every `self` binding already given to its files takes the form, and the runtime files' own
 * `self` exports follow (see {@link sharedSelfCallable}). Null forgets the instance (its shutdown, or a full reload's
 * old ID).
 * @param {string} instanceID - The instance.
 * @param {boolean|null} callable - Whether its api root is a function, or null to forget it.
 * @returns {void}
 * @internal
 */
function setInstanceSelfKind(instanceID, callable) {
	if (typeof instanceID !== "string") return;
	if (callable === null) {
		MapMethods.delete(SELF_KINDS, instanceID);
		MapMethods.delete(SELF_BINDINGS, instanceID);
		MapMethods.delete(SELF_CLOSED, instanceID);
		rebindSharedSelf();
		return;
	}
	const kind = Boolean(callable);
	if (MapMethods.get(SELF_KINDS, instanceID) === kind) return;
	MapMethods.set(SELF_KINDS, instanceID, kind);
	// A root closed before its kind changed is closed no more once the api is built again.
	MapMethods.delete(SELF_CLOSED, instanceID);
	for (const ofEntry of mapEntries(MapMethods.get(SELF_BINDINGS, instanceID))) {
		const url = ofEntry[0],
			setters = ofEntry[1];
		const form = instanceSelfForm(instanceID, url);
		if (form) for (const set of setValues(setters)) set(form);
	}
	rebindSharedSelf();
}

/**
 * The key under which each runtime entry file's `self` answers the function that binds an instance file's `self`
 * (#803), whoever reads it and whether or not a call runs: see {@link bindInstanceSelf}. It starts with a NUL, which no
 * api member's name can hold.
 * @type {string}
 * @internal
 */
const SELF_BIND_KEY = "\u0000slothlet:bindSelf";

/**
 * Give a `self` binding of an instance's file its form, now and whenever the instance's form is set (#803). The code
 * of {@link selfModuleSource} calls it, through the runtime file's own `self` (see {@link SELF_BIND_KEY}). It hands out
 * only one of the two forms the runtime file made, which any module can import, and takes nothing from its caller but
 * a function to call.
 * @param {string} url - The runtime file's URL.
 * @param {string} instanceID - The instance.
 * @param {function(object): void} assign - Sets the binding.
 * @returns {void}
 * @internal
 */
function bindInstanceSelf(url, instanceID, assign) {
	const forms = MapMethods.get(SELF_FORMS, url);
	if (!forms || typeof instanceID !== "string" || typeof assign !== "function") return;
	let byURL = MapMethods.get(SELF_BINDINGS, instanceID);
	if (!byURL) MapMethods.set(SELF_BINDINGS, instanceID, (byURL = new Map()));
	let setters = MapMethods.get(byURL, url);
	if (!setters) MapMethods.set(byURL, url, (setters = new Set()));
	SetMethods.add(setters, assign);
	assign(instanceSelfForm(instanceID, url));
}

/**
 * The source of the module an instance's file is given for one of slothlet's runtime entry files (#803): everything
 * the file exports, with a `self` of the instance's own form. `self` is a live binding: it takes the callable form once
 * the instance's api is built with a function root.
 * The module reaches slothlet through the runtime file's own `self` alone (see {@link SELF_BIND_KEY}), never through
 * the global object, so it loads whatever a module has done to the realm's built-ins, and it binds through the copy of
 * slothlet that evaluated the runtime file.
 * @param {string} instanceID - The instance.
 * @param {string} url - The runtime file's URL.
 * @param {string} [specifier=url] - What the module imports the file by (under vite, its module id).
 * @returns {string} The module's source.
 * @private
 */
function selfModuleSource(instanceID, url, specifier = url) {
	return (
		`export * from ${JSON.stringify(specifier)};\n` +
		`import { self as shared } from ${JSON.stringify(specifier)};\n` +
		`export let self = shared;\n` +
		`shared[${JSON.stringify(SELF_BIND_KEY)}](${JSON.stringify(instanceID)}, (form) => { self = form; });\n`
	);
}

/**
 * Whether a file's source plainly makes its default export a function (#803): `export default function` / `async
 * function` / `class` / an arrow, `export default name` where `name` is declared as one of those, or a CommonJS
 * `module.exports = function` / `class` / an arrow. A read of the text only, nothing runs; anything else, and a file
 * that cannot be read, answers false. Slothlet evaluates such a root file before its siblings, so the files the base
 * load evaluates after it get the callable form of `self` from their first import.
 * @param {string} filePath - Absolute file path.
 * @returns {boolean} True when the default export is plainly a function.
 * @internal
 */
function defaultExportLooksCallable(filePath) {
	if (NODE === null || typeof filePath !== "string") return false;
	let source;
	try {
		source = NODE.fs.readFileSync(filePath, "utf8");
	} catch {
		return false;
	}
	// Regular expression literals only: the realm's `RegExp` may have been replaced since slothlet loaded.
	if (
		RegExpMethods.exec(/^\s*export\s+default\s+(?:async\s+)?(?:function\b|class\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/m, source) !== null
	)
		return true;
	if (
		RegExpMethods.exec(/^\s*module\.exports\s*=\s*(?:async\s+)?(?:function\b|class\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/m, source) !==
		null
	)
		return true;
	const named = RegExpMethods.exec(/^\s*export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/m, source)?.[1];
	if (!named) return false;
	const declaration =
		/^\s*(?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|class\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/gm;
	for (let match = RegExpMethods.exec(declaration, source); match !== null; match = RegExpMethods.exec(declaration, source)) {
		if (match[1] === named || match[2] === named || match[3] === named) return true;
	}
	return false;
}

/**
 * Whether a vite module id is one of slothlet's runtime entry files (#803).
 * @param {string} id - The module id: the file's path, perhaps with a query.
 * @returns {boolean} True for `runtime.mjs` and the two runtimes it dispatches to.
 * @private
 */
function isRuntimeEntryId(id) {
	const path = toSlashPath(splitQuery(id)[0]);
	return ArrayMethods.some(SINGLE_COPY_FILES, (url) => NODE !== null && path === toSlashPath(NODE.url.fileURLToPath(url)));
}

/**
 * The instance an importer of a runtime entry file belongs to, when it is one instance's own file (#803): the one its
 * URL names, or the one instance a CommonJS file of no instance tag is held by.
 * @param {string|undefined} parentURL - The importing file's URL.
 * @returns {string|null} The instance ID.
 * @private
 */
function selfInstanceOf(parentURL) {
	if (typeof parentURL !== "string") return null;
	const tagged = StringMethods.includes(parentURL, MARKER)
		? URLSearchParamsMethods.get(new URLSearchParams(splitQuery(parentURL)[1] ?? ""), "slothlet_instance")
		: null;
	if (tagged) return tagged;
	if (!StringMethods.startsWith(parentURL, "file:")) return null;
	const found = instancesOfFile(parentURL);
	return SetMethods.size(found) === 1 ? setToArray(found)[0] : null;
}

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
function registerOwnModule(url, namespace) {
	if (!ArrayMethods.includes(SINGLE_COPY_FILES, url) || MapMethods.has(OWN_MODULES, url)) return;
	MapMethods.set(OWN_MODULES, url, namespace);
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
	for (let ofIndex = 0, ofList = Objects.keys(MapMethods.get(OWN_MODULES, url)); ofIndex < ofList.length; ofIndex++) {
		const name = ofList[ofIndex];
		listPush(lines, `const n${n} = ns[${JSON.stringify(name)}];`, `export { n${n} as ${JSON.stringify(name)} };`);
		n++;
	}
	return ArrayMethods.join(lines, "\n") + "\n";
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
	while (queue.length && SetMethods.size(seen) < 64) {
		const next = ArrayMethods.shift(queue);
		if (typeof next !== "string" || SetMethods.has(seen, next)) continue;
		SetMethods.add(seen, next);
		const tagged = URLSearchParamsMethods.get(new URLSearchParams(splitQuery(next)[1] ?? ""), "slothlet_instance");
		if (tagged) {
			SetMethods.add(found, tagged);
			continue;
		}
		const path = packageKey(next);
		let held = false;
		for (const instanceID of mapKeys(SCOPE_KEYS)) {
			if (ArrayMethods.some(COMMONJS_READER.files(instanceID), (file) => packageKey(file) === path)) {
				SetMethods.add(found, instanceID);
				held = true;
			}
		}
		if (!held) appendList(queue, setToArray(MapMethods.get(PACKAGE_IMPORTERS, path)));
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
	if (
		ArrayMethods.some(OWN_TREE, (own) => path === own || StringMethods.startsWith(path, StringMethods.endsWith(own, "/") ? own : `${own}/`))
	)
		return true;
	let other = false;
	for (const instanceID of setValues(instancesOfFile(parentURL))) {
		if (SetMethods.has(OWN_CLAIMS, instanceID)) return false;
		if (MapMethods.has(CLAIMS, instanceID)) other = true;
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
		(StringMethods.startsWith(specifier, "./") ||
			StringMethods.startsWith(specifier, "../") ||
			StringMethods.startsWith(specifier, "/") ||
			StringMethods.startsWith(specifier, "file:"))
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
	const cut = regExpSearch(/[?#]/, p);
	if (cut !== -1) p = StringMethods.slice(p, 0, cut);
	if (StringMethods.startsWith(p, "file:")) {
		p = decodeURIComponent(regExpReplace(/^file:\/\/[^/]*/, p, ""));
	}
	return regExpReplace(/\\/g, p, "/");
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
	return RegExpMethods.exec(/^\/[A-Za-z]:\//, path) !== null ? StringMethods.slice(path, 1) : path;
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
	const idx = StringMethods.lastIndexOf(slashPath, "/node_modules/");
	if (idx === -1) return null;
	const rest = splitText(StringMethods.slice(slashPath, idx + "/node_modules/".length), "/");
	const depth = typeof rest[0] === "string" && StringMethods.startsWith(rest[0], "@") ? 2 : 1;
	return StringMethods.slice(slashPath, 0, idx) + "/node_modules/" + ArrayMethods.join(copyList(rest, 0, depth), "/");
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
	const filePath = regExpReplace(/^\/([a-z]:\/)/i, slashPath, "$1");
	const walked = [];
	let root = null;
	for (
		let dir = StringMethods.slice(filePath, 0, StringMethods.lastIndexOf(filePath, "/"));
		;
		dir = StringMethods.slice(dir, 0, StringMethods.lastIndexOf(dir, "/"))
	) {
		if (MapMethods.has(PACKAGE_ROOTS, dir)) {
			root = MapMethods.get(PACKAGE_ROOTS, dir);
			break;
		}
		listPush(walked, dir);
		if (isPackageRoot(HOST, dir)) {
			root = dir;
			break;
		}
		if (!StringMethods.includes(dir, "/")) break;
	}
	for (let ofIndex = 0, ofList = walked; ofIndex < ofList.length; ofIndex++) {
		const dir = ofList[ofIndex];
		MapMethods.set(PACKAGE_ROOTS, dir, root);
	}
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
	if (
		ArrayMethods.some(
			OWN_PREFIXES,
			(own) => childPath === own || (StringMethods.endsWith(own, "/") && StringMethods.startsWith(childPath, own))
		)
	)
		return false;
	const childPkg = nodeModulesPackage(childPath);
	const parentPath = toSlashPath(parent);
	// Neither under `node_modules` and in one directory: the same package, without reading the filesystem.
	if (
		childPkg === null &&
		nodeModulesPackage(parentPath) === null &&
		StringMethods.slice(childPath, 0, StringMethods.lastIndexOf(childPath, "/")) ===
			StringMethods.slice(parentPath, 0, StringMethods.lastIndexOf(parentPath, "/"))
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
	if (
		ArrayMethods.some(
			OWN_TREE,
			(own) => childPath === own || StringMethods.startsWith(childPath, StringMethods.endsWith(own, "/") ? own : `${own}/`)
		)
	)
		return false;
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
	if (StringMethods.startsWith(specifier, "#")) return true;
	const root = packageRoot(toSlashPath(importer));
	if (root === null) return false;
	const name = packageName(root);
	return name !== null && (specifier === name || StringMethods.startsWith(specifier, `${name}/`));
}

/**
 * The name a package's `package.json` gives it (see {@link PACKAGE_NAMES}), or null when it gives none.
 * @param {string} root - The package's directory, as {@link packageRoot} found it.
 * @returns {string|null} The name.
 * @private
 */
function packageName(root) {
	if (!MapMethods.has(PACKAGE_NAMES, root)) {
		let name = null;
		try {
			name = HOST.parseJSON(HOST.readFile(`${root}/package.json`, "utf8")).name ?? null;
		} catch {
			// A package `packageRoot` found under `node_modules` with no readable manifest has no name to refer to itself by.
		}
		MapMethods.set(PACKAGE_NAMES, root, typeof name === "string" ? name : null);
	}
	return MapMethods.get(PACKAGE_NAMES, root);
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
	if (
		!StringMethods.includes(path, "/src/") &&
		!StringMethods.includes(path, "/dist/") &&
		!ArrayMethods.some(ENTRY_FILES, (entry) => StringMethods.endsWith(path, `/${entry}`))
	)
		return null;
	const root = packageRoot(path);
	if (root === null || packageName(root) !== "@cldmv/slothlet") return null;
	const inside = StringMethods.slice(
		StringMethods.startsWith(path, `${root}/`) ? path : regExpReplace(/^\/([a-z]:\/)/i, path, "$1"),
		root.length + 1
	);
	return ArrayMethods.some(CODE_DIRS, (dir) => StringMethods.startsWith(inside, dir)) || ArrayMethods.includes(ENTRY_FILES, inside)
		? inside
		: null;
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
	if (inside === null || ArrayMethods.includes(ENTRY_FILES, inside)) return false;
	const dir = ArrayMethods.find(CODE_DIRS, (code) => StringMethods.startsWith(inside, code));
	return !ArrayMethods.includes(MODULE_IMPORTABLE, StringMethods.slice(inside, dir.length));
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
function noteModuleFile(ref) {
	if (typeof ref === "string" && ref !== "") SetMethods.add(MODULE_FILES, packageKey(ref));
}

/**
 * The folders a browser loaded api files from (see {@link noteModuleRoot}), each as a URL path ending in `/`.
 * @type {Set<string>}
 * @private
 */
const MODULE_ROOTS = new Set();

/**
 * Record the folder a browser loaded an api file from, so a helper file a leaf imports from that folder (which carries
 * no instance tag in a browser) is told to be a module's code, as its frames are placed for attribution. The folder is
 * the URL the file was imported from without the file's path in its manifest; a URL that does not end in that path (a
 * resolver's `blob:` or `data:` URL) names none. A folder at the root of its origin would hold the page's own files too,
 * and so holds nothing, as a module mounted from `/` owns no frames.
 * @param {string} url - The URL the api file was imported from.
 * @param {string} filePath - The file's path in the manifest.
 * @returns {void}
 * @internal
 */
function noteModuleRoot(url, filePath) {
	if (typeof url !== "string" || typeof filePath !== "string" || filePath === "") return;
	const location = toSlashPath(url);
	const suffix = "/" + regExpReplace(/^\.?\//, filePath, "");
	if (!StringMethods.endsWith(location, suffix)) return;
	const root = StringMethods.slice(location, 0, location.length - suffix.length + 1);
	let parsed;
	try {
		parsed = new URL(root);
	} catch {
		return;
	}
	if ((URLMethods.protocol(parsed) !== "http:" && URLMethods.protocol(parsed) !== "https:") || URLMethods.pathname(parsed) === "/") return;
	SetMethods.add(MODULE_ROOTS, root);
}

/**
 * Whether a location is in a folder a browser loaded api files from (see {@link noteModuleRoot}), and not a package's.
 * @param {string} location - A frame's location.
 * @returns {boolean} True when it is.
 * @private
 */
function isModuleRootLocation(location) {
	if (SetMethods.size(MODULE_ROOTS) === 0) return false;
	const path = toSlashPath(location);
	for (const root of setValues(MODULE_ROOTS))
		if (StringMethods.startsWith(path, root) && !StringMethods.includes("/" + StringMethods.slice(path, root.length), "/node_modules/"))
			return true;
	return false;
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
	if (typeof ref !== "string" || StringMethods.includes(ref, MARKER) || slothletCodePath(ref) !== null) return false;
	const key = packageKey(ref);
	if (SetMethods.has(MODULE_FILES, key)) return true;
	if (ACTIVE !== null && (key === packageKey(ACTIVE.anchor) || isInstanceScopedFile(key, ACTIVE.anchor))) return true;
	for (const instanceID of mapKeys(SCOPE_KEYS))
		if (ArrayMethods.some(COMMONJS_READER.files(instanceID), (file) => packageKey(file) === key)) return true;
	if (RegExpMethods.exec(/\/node_modules\//, key) !== null) return false;
	const seen = setFrom([key]);
	const queue = [key];
	while (queue.length && SetMethods.size(seen) < 64) {
		for (const loader of setValues(MapMethods.get(PACKAGE_IMPORTERS, ArrayMethods.shift(queue)))) {
			if (StringMethods.includes(loader, MARKER) || SetMethods.has(MODULE_FILES, packageKey(loader))) {
				if (isInstanceScopedFile(key, splitQuery(loader)[0])) return true;
				continue;
			}
			const through = packageKey(loader);
			if (!SetMethods.has(seen, through) && !(RegExpMethods.exec(/\/node_modules\//, through) !== null)) {
				SetMethods.add(seen, through);
				listPush(queue, through);
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
	const match =
		RegExpMethods.exec(/\(([^()]+):\d+:\d+\)\s*$/, line) ?? RegExpMethods.exec(/^\s*at (?:async )?([^\s()]+):\d+:\d+\s*$/, line);
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
	const lines = copyList(splitText(ownStackText(64), "\n"), 1);
	let i = 0;
	// The resolve hook's own frames, then Node's loader.
	while (i < lines.length && slothletCodePath(frameLocation(lines[i]) ?? "") !== null) i++;
	while (i < lines.length && StringMethods.startsWith(frameLocation(lines[i]) ?? "node:", "node:")) i++;
	const caller = i < lines.length ? frameLocation(lines[i]) : null;
	if (caller === null || slothletCodePath(caller) !== null) return false;
	return RegExpMethods.exec(INSTANCE_FRAME, caller) !== null || isUntaggedModuleFile(caller);
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
		if (StringMethods.includes(parentURL, MARKER)) return true;
		if (
			slothletCodePath(parentURL) === null &&
			(StringMethods.startsWith(parentURL, "file:") ? isUntaggedModuleFile(parentURL) : SetMethods.has(MODULE_URLS, parentURL))
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
function setImportRefusal(make) {
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
	// A `data:` or `blob:` URL is code the module wrote: refused unless a rule opens `capability:imports` for it.
	refuseCodeImport(text, typeof importer === "string" && StringMethods.includes(importer, MARKER) ? importer : null, []);
	if (
		RegExpMethods.exec(/^[a-z][a-z0-9+.-]+:/i, text) !== null &&
		!StringMethods.startsWith(text, "file:") &&
		!StringMethods.startsWith(text, "node:")
	)
		SetMethods.add(MODULE_URLS, text);
	if (isFileSpecifier(text) || RegExpMethods.exec(/^[A-Za-z]:[\\/]/, text) !== null) {
		let file = text;
		if (
			!StringMethods.startsWith(text, "file:") &&
			!(StringMethods.startsWith(text, "/") || RegExpMethods.exec(/^[A-Za-z]:[\\/]/, text) !== null)
		)
			file = URLMethods.href(new URL(text, importer));
		if (isSlothletInternal(file)) throw importRefusal(text, file);
		// A URL the module wrote out naming an instance, under vite, which does not name the module importing by it: it
		// loses the tags only slothlet gives and is an edge of that instance's import graph from this module, as Node's
		// resolve hook has it (#691).
		const instanceID = StringMethods.includes(text, MARKER)
			? URLSearchParamsMethods.get(new URLSearchParams(splitQuery(text)[1] ?? ""), "slothlet_instance")
			: null;
		if (instanceID) {
			const untagged = withoutWrittenTags(text);
			if (typeof importer === "string") recordImport(instanceID, importer, withoutWrittenTags(file));
			return untagged;
		}
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
			const { SlothletError } = await import("#errors");
			IMPORT_REFUSAL = ({ specifier: named, file: target, allowed }) =>
				new SlothletError("MODULE_INTERNAL_NOT_IMPORTABLE", { specifier: named, file: target, allowed });
		} catch {
			// Without slothlet's errors loadable here the refusal carries its code alone (see importRefusal).
		}
	}
	return importRefusal(specifier, file);
}

/**
 * The error the vite plugin throws for an `import` statement of a `data:` or `blob:` URL in an instance file:
 * `PERMISSION_CAPABILITY_REFUSED`, slothlet's own error loaded where the plugin runs.
 * @param {string} importer - The importing file.
 * @returns {Promise<Error>} The error.
 * @private
 */
async function viteCapabilityRefusal(importer) {
	try {
		const { SlothletError } = await import("#errors");
		const { translate } = await import("#i18n");
		// The vite server holds none of the instance's rules: the import is no leaf's it could decide for.
		const refusal = new SlothletError("PERMISSION_CAPABILITY_REFUSED", {
			caller: importer,
			capability: "imports",
			route: "import",
			reason: translate("PERMISSION_CAPABILITY_REASON_UNATTRIBUTED")
		});
		refusal.context.reasonCode = "unattributed";
		return refusal;
	} catch {
		/* v8 ignore next 4 -- slothlet's errors are loadable wherever the plugin runs; the code alone otherwise. */
		const error = new PristineError(`PERMISSION_CAPABILITY_REFUSED: imports (import) ${importer}`);
		error.code = "PERMISSION_CAPABILITY_REFUSED";
		return error;
	}
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
	if (
		typeof url === "string" &&
		!StringMethods.startsWith(url, "file:") &&
		!StringMethods.startsWith(url, "node:") &&
		isModuleImport(context?.parentURL, [])
	) {
		// A module an instance's file imports by a URL that is no file's: what it imports is held as the file's imports are.
		SetMethods.add(MODULE_URLS, url);
		return;
	}
	if (!isSlothletInternal(url)) return;
	if (isModuleImport(context?.parentURL, context?.conditions)) throw importRefusal(specifier, url);
}

/**
 * The capability check (see `helpers/capability-context`), registered by it as it loads; null until then.
 * @type {?function(string, string, ?string): void}
 * @private
 */
let CAPABILITY_CHECK = null;

/**
 * Register the capability check the import hooks ask (see {@link refuseCodeImport}). Taken once.
 * @param {function(string, string, ?string): void} check - The check.
 * @returns {void}
 * @internal
 */
function setCapabilityCheck(check) {
	if (CAPABILITY_CHECK === null && typeof check === "function") CAPABILITY_CHECK = check;
}

/**
 * Refuse module code importing a `data:` or `blob:` URL, unless a rule opens `capability:imports` for it: the code a
 * module would get that way is whatever text it wrote. Asked as the import is resolved, which for an `import()` is
 * inside the call that made it, so the code making it decides; for a file's own `import` statement, which is resolved
 * as the file links, the file is the instance's and is refused.
 * @param {string} specifier - The specifier.
 * @param {string|null} parentURL - The importer.
 * @param {Array<string>|undefined} conditions - The resolution's conditions.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED`.
 * @private
 */
function refuseCodeImport(specifier, parentURL, conditions) {
	if (CAPABILITY_CHECK === null || typeof specifier !== "string" || !(RegExpMethods.exec(/^(?:data|blob):/i, specifier) !== null)) return;
	CAPABILITY_CHECK("imports", "import()", isModuleImport(parentURL, conditions ?? []) ? parentURL : null);
}

/**
 * Where slothlet's own code is in this copy: its code folder (`src/` or `dist/`) and the package's entry files, as
 * {@link toSlashPath} gives them. Read from this file's own URL, so it holds wherever slothlet is served from (a
 * browser's `http:` URL as well as a `file:` URL), and stays the same when a module changes anything after load.
 * @type {string[]}
 * @private
 */
const OWN_CODE = mapList(
	[new URL("../../", import.meta.url), new URL("../../../index.mjs", import.meta.url), new URL("../../../index.cjs", import.meta.url)],
	(u) => toSlashPath(URLMethods.href(u))
);

/**
 * A stack line of a built-in function, which has no location of its own (`Array.map`, `new Promise`, `Promise.all`):
 * it runs code on behalf of the frame further out, which decides.
 * @type {RegExp}
 * @private
 */
const BUILT_IN_FRAME = /\((?:<anonymous>|native|index \d+)\)\s*$/;

/**
 * The location a stack line names, in the formats of V8 (`at fn (where:1:2)`, `at where:1:2`) and of the other engines
 * (`fn@where:1:2`), or null when it names none a file can be told from (a built-in). Code compiled from text (`eval`,
 * `new Function`) is placed where it was compiled: the file whose code compiled it, which the engine names in the line
 * (`eval at f (where:1:2)`, `where line 1 > eval`); a line naming no such file is null.
 * @param {string} line - One line of a stack.
 * @returns {string|null} The location.
 * @private
 */
function stackLineLocation(line) {
	if (RegExpMethods.exec(/\beval at /, line) !== null) return RegExpMethods.exec(/\(([^()]+?):\d+:\d+\)/, line)?.[1] ?? null;
	const compiled = RegExpMethods.exec(/^[^@\s]*@(.+?) line \d+ > (?:eval|Function)\b/, line);
	if (compiled !== null) return compiled[1];
	const match =
		RegExpMethods.exec(/\(([^()]+):\d+:\d+\)\s*$/, line) ??
		RegExpMethods.exec(/^\s*at (?:async )?([^()]+?):\d+:\d+\s*$/, line) ??
		RegExpMethods.exec(/^[^@\s]*@(.+?):\d+:\d+\s*$/, line);
	return match === null ? null : match[1];
}

/**
 * Whether a location is one of slothlet's own files: in this copy's code (see {@link OWN_CODE}), or, under Node, in any
 * copy of slothlet's (see {@link slothletCodePath}).
 * @param {string} location - A frame's location.
 * @returns {boolean} True for slothlet's own code.
 * @private
 */
function isOwnCodeLocation(location) {
	const path = toSlashPath(location);
	if (StringMethods.startsWith(path, OWN_CODE[0]) || path === OWN_CODE[1] || path === OWN_CODE[2]) return true;
	return slothletCodePath(location) !== null;
}

/**
 * Whether a location is a module's code (as {@link isModuleImport} tells an importer): an instance's copy of a file, a
 * module an instance's file imported by a URL that is no file's, or a file of a module's that no instance tags.
 * @param {string} location - A frame's location.
 * @returns {boolean} True for a module's code.
 * @private
 */
function isModuleCodeLocation(location) {
	return (
		StringMethods.includes(location, MARKER) ||
		SetMethods.has(MODULE_URLS, location) ||
		isUntaggedModuleFile(location) ||
		isModuleRootLocation(location)
	);
}

/**
 * The most frames {@link mayUseInternal} reads. Past them, code is the host's only when a frame it read was a
 * package's, as attribution's own limit has it.
 * @type {number}
 * @private
 */
const USE_FRAME_LIMIT = 1024;

/**
 * Whether the code using one of slothlet's internal exports now may: the frame that called it, read past slothlet's
 * own frames, built-in functions, Node's own frames and files of packages, is the host's code. Code of a module is
 * refused (code it compiled with `eval` or `new Function` included), and so is code that cannot be placed (no frame at
 * all: a function handed to a scheduler).
 * A package's frame passes the answer outward, to the frame that called the package, so a module handing an export to
 * a library to call is still the module; a package's code with nothing further out (its own top level) is the host's.
 *
 * Slothlet's own files reach each other's internal bindings through their files' `internals` (see
 * {@link claimOwnBindings}), so a frame of slothlet's own that calls an export is slothlet calling code it was handed:
 * the answer is the frame further out.
 * @returns {boolean} True when the code using it is the host's.
 * @private
 */
function mayUseInternal() {
	let stack;
	try {
		stack = ownStackText(USE_FRAME_LIMIT);
	} catch {
		// The stack could not be read with slothlet's own formatter: who is using the export cannot be told.
		return false;
	}
	let packageSeen = false;
	for (let ofIndex = 0, ofList = splitText(stack, "\n"); ofIndex < ofList.length; ofIndex++) {
		const line = ofList[ofIndex];
		if (!(RegExpMethods.exec(/\S/, line) !== null) || RegExpMethods.exec(/^\s*Error\s*$/, line) !== null) continue;
		const location = stackLineLocation(line);
		if (location === null) {
			if (RegExpMethods.exec(BUILT_IN_FRAME, line) !== null) continue;
			return false;
		}
		if (StringMethods.startsWith(location, "node:") || isOwnCodeLocation(location)) continue;
		if (isModuleCodeLocation(location)) return false;
		if (RegExpMethods.exec(/\/node_modules\//, toSlashPath(location)) !== null) {
			packageSeen = true;
			continue;
		}
		return true;
	}
	return packageSeen;
}

/**
 * The error for a module's use of one of slothlet's internal exports: the error of a refused import (see
 * {@link importRefusal}), naming the export and its file.
 * @param {string} name - The export's name.
 * @param {string} file - Its file's URL.
 * @returns {Error} The error.
 * @private
 */
function useRefusal(name, file) {
	return importRefusal(name, file);
}

/**
 * The guarded stand-in of each internal export (see {@link guardInternal}), by the value it stands for, and of each
 * method a guarded object hands out, by the method and then the object.
 * @type {WeakMap<object, object>}
 * @private
 */
const GUARDED = new WeakMap();

/**
 * Every guarded stand-in {@link guardInternal} made, so slothlet's own code can tell one apart without touching it.
 * @type {WeakSet<object>}
 * @private
 */
const GUARD_PROXIES = new WeakSet();

/**
 * Whether a value is one of the guarded stand-ins of slothlet's internal exports (see {@link guardInternal}), told
 * without using it: for slothlet's own code that walks a file's exports (a component scan), which must pass over them
 * whoever is calling it.
 * @param {*} value - A value.
 * @returns {boolean} True for a guarded stand-in.
 * @internal
 */
export function isGuardedInternal(value) {
	return (typeof value === "function" || (typeof value === "object" && value !== null)) && WeakSetMethods.has(GUARD_PROXIES, value);
}

/**
 * See {@link GUARDED}: a method a guarded object hands out, bound to the object it was read from.
 * @type {WeakMap<Function, WeakMap<object, Function>>}
 * @private
 */
const GUARDED_METHODS = new WeakMap();

/**
 * The traps of a guarded stand-in, each checking who uses it before doing what the value itself does.
 * @type {string[]}
 * @private
 */
const GUARD_TRAPS = [
	"apply",
	"construct",
	"defineProperty",
	"deleteProperty",
	"get",
	"getOwnPropertyDescriptor",
	"getPrototypeOf",
	"has",
	"isExtensible",
	"ownKeys",
	"preventExtensions",
	"set",
	"setPrototypeOf"
];

/**
 * Keep one of slothlet's internal exports to slothlet's own files and the host: the stand-in a file exports in its
 * place. Using it (calling it, constructing it, reading or changing it) answers only the host's code (see
 * {@link mayUseInternal}); a module's code is refused with `MODULE_INTERNAL_NOT_IMPORTABLE`, whichever way it came to
 * hold it. Slothlet's own files use the export itself, through their files' `internals`.
 *
 * A function stays a function and a class a class (`instanceof` and `extends` work as before). An object's methods are
 * handed out bound to the object, each guarded the same way, so a context manager is used as before. A primitive is
 * returned as it is.
 * @template T
 * @param {T} value - The export.
 * @param {string} name - Its name.
 * @param {string} file - Its file's `import.meta.url`.
 * @returns {T} The guarded stand-in.
 * @internal
 * @example
 * const guarded = guardInternal(enterCall, "enterCall", import.meta.url);
 * export { guarded as enterCall };
 */
export function guardInternal(value, name, file) {
	if (typeof value !== "function" && (typeof value !== "object" || value === null)) return value;
	const known = WeakMapMethods.get(GUARDED, value);
	if (known !== undefined) return known;
	const check = () => {
		if (!mayUseInternal()) throw useRefusal(name, file);
	};
	const handler = { __proto__: null };
	for (let ofIndex = 0, ofList = GUARD_TRAPS; ofIndex < ofList.length; ofIndex++) {
		const trap = ofList[ofIndex];
		handler[trap] = (...args) => {
			check();
			return Reflect.apply(Reflect[trap], undefined, args);
		};
	}
	let guarded;
	handler.construct = (target, args, newTarget) => {
		check();
		return Reflect.construct(target, args, newTarget === guarded ? target : newTarget);
	};
	if (typeof value !== "function") {
		// An object: its members are read and written on the object itself, and its methods are bound to it.
		handler.get = (target, key) => {
			check();
			const member = Reflect.get(target, key, target);
			return typeof member === "function" ? guardedMethod(member, target, `${name}.${String(key)}`, file) : member;
		};
		handler.set = (target, key, member) => {
			check();
			return Reflect.set(target, key, member, target);
		};
	}
	guarded = new NativeProxy(value, handler);
	WeakMapMethods.set(GUARDED, value, guarded);
	WeakSetMethods.add(GUARD_PROXIES, guarded);
	return guarded;
}

/**
 * A method a guarded object hands out (see {@link guardInternal}): the method, run on the object it was read from,
 * guarded as the object is. One per method and object, so reading it twice gives the same function.
 * @param {Function} method - The method.
 * @param {object} target - The object it was read from.
 * @param {string} name - What it is called, for the refusal.
 * @param {string} file - Its file's URL.
 * @returns {Function} The guarded method.
 * @private
 */
function guardedMethod(method, target, name, file) {
	let byTarget = WeakMapMethods.get(GUARDED_METHODS, method);
	if (byTarget === undefined) WeakMapMethods.set(GUARDED_METHODS, method, (byTarget = new WeakMap()));
	let guarded = WeakMapMethods.get(byTarget, target);
	if (guarded === undefined) {
		guarded = new NativeProxy(method, {
			apply(fn, _thisArg, args) {
				if (!mayUseInternal()) throw useRefusal(name, file);
				return Reflect.apply(fn, target, args);
			}
		});
		WeakMapMethods.set(byTarget, target, guarded);
		WeakSetMethods.add(GUARD_PROXIES, guarded);
	}
	return guarded;
}

/**
 * The error for a request for one of slothlet's files' internal bindings that is not one of slothlet's own (see the
 * `internals` function of each such file).
 *
 * Slothlet's own files reach each other's internal bindings through a private channel: every file with internal exports
 * has an `internals(consumer)` function that hands its bindings to the files of slothlet's that use them, each named
 * in a list the file keeps, and each once, as it loads. Slothlet's files are evaluated before any module's code can run,
 * and every file of the list takes its bindings as it is evaluated, so whoever asks later (code holding a file's
 * `internals` by any route) is refused. No stack is read: it holds where slothlet's files are bundled into one, and costs
 * nothing per call. What the files export besides is guarded (see {@link guardInternal}).
 * @param {string} file - The file asked (`lib/handlers/frame-placement`).
 * @param {string} url - Its `import.meta.url`.
 * @returns {Error} MODULE_INTERNAL_NOT_IMPORTABLE.
 * @internal
 * @example
 * export function internals(consumer) {
 * 	if (!mayTakeInternals(consumer, ["lib/handlers/context-live"])) throw ownBindingsRefusal("lib/handlers/frame-placement", import.meta.url);
 * 	return { enterCall };
 * }
 */
export function ownBindingsRefusal(file, url) {
	return importRefusal(`${file} internals`, url);
}

/**
 * Whether the code asking for a file's internal bindings a second time under a consumer's name is that consumer's own
 * file being evaluated again, at its top level, by a module loader: a second copy of the file in the process (a loader
 * evaluating it under another URL) that shares this copy's other files. Read from the stack: the frame below slothlet's
 * own frames is the consumer's file in this copy's code, with no function of its own (its top level), and the frame
 * that runs it is a module loader's (Node's, or vite's module runner). Anything else (another frame, a function of the
 * file, a listener a loader-free caller runs) is refused; so is every engine without such frames (a browser).
 * @param {string} consumer - The consumer, as its file's path in slothlet's code folder without its extension.
 * @returns {boolean} True for the file's own top level, run by a loader.
 * @internal
 */
export function isOwnTopLevelOf(consumer) {
	if (typeof consumer !== "string") return false;
	const file = `${OWN_CODE[0]}${consumer}.mjs`;
	let stack;
	try {
		stack = ownStackText(64);
	} catch {
		return false;
	}
	const lines = filterList(splitText(stack, "\n"), (line) => RegExpMethods.exec(/^\s*at /, line) !== null);
	let i = 0;
	while (i < lines.length) {
		const location = stackLineLocation(lines[i]);
		if (location === null) return false;
		if (toSlashPath(location) === file) break;
		if (!isOwnCodeLocation(location)) return false;
		i++;
	}
	// The file's own top level: a frame with a location and no function name.
	if (i >= lines.length || !(RegExpMethods.exec(/^\s*at (?:async )?[^()]+?:\d+:\d+\s*$/, lines[i]) !== null)) return false;
	let next = i + 1;
	// Vite's runner evaluates a module after an await, so the microtask runner's frame sits between.
	if (next < lines.length && RegExpMethods.exec(/node:internal\/process\/task_queues/, lines[next]) !== null) next++;
	return (
		next < lines.length &&
		RegExpMethods.exec(
			/node:internal\/modules\/|\/node_modules\/(?:vite|vitest)\/dist\/[^\s()]*module-(?:runner|evaluator)/,
			lines[next]
		) !== null
	);
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
	if (typeof parent !== "string" || !StringMethods.includes(parent, MARKER)) return withoutWrittenHelperTags(parent, child);
	if (typeof child !== "string" || typeof specifier !== "string" || StringMethods.startsWith(specifier, "node:")) return child;
	if (!(
		StringMethods.startsWith(child, "file:") ||
		StringMethods.startsWith(child, "/") ||
		RegExpMethods.exec(/^[A-Za-z]:[\\/]/, child) !== null
	))
		return child;
	const unpacked1 = splitQuery(child),
		childBase = unpacked1[0],
		childQuery = unpacked1[1] === undefined ? "" : unpacked1[1];
	const childParams = new URLSearchParams(childQuery);
	const unpacked2 = splitQuery(parent),
		parentBase = unpacked2[0],
		parentQuery = unpacked2[1] === undefined ? "" : unpacked2[1];
	const parentParams = new URLSearchParams(parentQuery);
	// A child that names its instance itself (a URL the importer wrote out) keeps the instance it names. Which api file
	// a helper copy is loaded for is never the importer's to write: those tags are dropped and given as below.
	const written = URLSearchParamsMethods.has(childParams, "slothlet_instance");
	if (written) {
		// The module-system bridges slothlet serves (require of an ES module) import the URL slothlet built.
		if (StringMethods.startsWith(parent, ESM_PREFIX) || StringMethods.startsWith(parent, FACADE_PREFIX)) return child;
		if (!ArrayMethods.some(WRITTEN_TAGS, (key) => URLSearchParamsMethods.has(childParams, key))) return child;
		for (let ofIndex = 0, ofList = WRITTEN_TAGS; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			URLSearchParamsMethods.delete(childParams, key);
		}
	} else {
		if (!belongsToInstance(specifier, childBase, parent)) return child;
		for (let ofIndex = 0, ofList = INSTANCE_QUERY_KEYS; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (URLSearchParamsMethods.has(parentParams, key))
				URLSearchParamsMethods.set(childParams, key, URLSearchParamsMethods.get(parentParams, key));
		}
	}
	// Helpers loaded once per importing api file: the copy names the api file it is loaded for (the importer, or the
	// file the importing helper's own copy was loaded for) and that file's mount.
	if (URLSearchParamsMethods.get(parentParams, HELPERS_PARAM) === HELPERS_PER_MODULE) {
		URLSearchParamsMethods.set(childParams, HELPERS_PARAM, HELPERS_PER_MODULE);
		const loadedFor = URLSearchParamsMethods.get(parentParams, HELPERS_FOR_PARAM);
		URLSearchParamsMethods.set(childParams, HELPERS_FOR_PARAM, loadedFor ?? helperImporterPath(parentBase));
		const mount =
			loadedFor === null
				? URLSearchParamsMethods.get(parentParams, "module")
				: URLSearchParamsMethods.get(parentParams, HELPERS_MOUNT_PARAM);
		if (mount !== null) URLSearchParamsMethods.set(childParams, HELPERS_MOUNT_PARAM, mount);
	}
	const hashIdx = StringMethods.indexOf(childBase, "#");
	const base = hashIdx === -1 ? childBase : StringMethods.slice(childBase, 0, hashIdx);
	const hash = hashIdx === -1 ? "" : StringMethods.slice(childBase, hashIdx);
	return `${base}?${URLSearchParamsMethods.toString(childParams)}${hash}`;
}

/**
 * The tags that say a file is a helper copy loaded for one api file (`helpers: "module"`). Only slothlet gives them:
 * the loader to a leaf, and the resolve hook to what a tagged file imports.
 * @type {string[]}
 * @private
 */
const HELPER_TAGS = [HELPERS_PARAM, HELPERS_FOR_PARAM, HELPERS_MOUNT_PARAM];

/**
 * The tags a URL an importer writes out never keeps: the helper tags, and the mount a leaf's own module is loaded
 * under, which only slothlet's loader gives (#691). A file imported under a mount tag its importer wrote is a module
 * of the importer's making, not the leaf's.
 * @type {string[]}
 * @private
 */
const WRITTEN_TAGS = concatLists(HELPER_TAGS, ["module"]);

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
	if (typeof parent === "string" && ArrayMethods.some(OWN_PREFIXES, (prefix) => StringMethods.startsWith(toSlashPath(parent), prefix)))
		return child;
	// Slothlet's loader imports a leaf from its own files; a first import with no importer is the host's entry.
	if (typeof parent !== "string") return child;
	return withoutWrittenTags(child);
}

/**
 * A resolved child without the tags only slothlet gives (see {@link WRITTEN_TAGS}).
 * @param {string} child - The resolved child URL or id.
 * @returns {string} `child`, without them.
 * @private
 */
function withoutWrittenTags(child) {
	if (typeof child !== "string" || !StringMethods.includes(child, MARKER)) return child;
	if (!ArrayMethods.some(WRITTEN_TAGS, (key) => URLSearchParamsMethods.has(new URLSearchParams(splitQuery(child)[1] ?? ""), key)))
		return child;
	const unpacked3 = splitQuery(child),
		childBase = unpacked3[0],
		childQuery = unpacked3[1] === undefined ? "" : unpacked3[1];
	const childParams = new URLSearchParams(childQuery);
	for (let ofIndex = 0, ofList = WRITTEN_TAGS; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		URLSearchParamsMethods.delete(childParams, key);
	}
	const hashIdx = StringMethods.indexOf(childBase, "#");
	const base = hashIdx === -1 ? childBase : StringMethods.slice(childBase, 0, hashIdx);
	const hash = hashIdx === -1 ? "" : StringMethods.slice(childBase, hashIdx);
	return `${base}?${URLSearchParamsMethods.toString(childParams)}${hash}`;
}

/**
 * Split a URL/id into its part before `?` and its query (without `?` and without any `#hash`).
 * @param {string} ref - URL or id.
 * @returns {string[]} `[base, query]`; `query` is undefined when there is none.
 * @private
 */
function splitQuery(ref) {
	const q = StringMethods.indexOf(ref, "?");
	if (q === -1) return [ref];
	const hash = StringMethods.indexOf(ref, "#", q);
	return hash === -1
		? [StringMethods.slice(ref, 0, q), StringMethods.slice(ref, q + 1)]
		: [StringMethods.slice(ref, 0, q) + StringMethods.slice(ref, hash), StringMethods.slice(ref, q + 1, hash)];
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
	const requireFn = NODE.module.createRequire(filePath);
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

	if (!MapMethods.has(SCOPE_KEYS, instanceID)) MapMethods.set(SCOPE_KEYS, instanceID, Objects.freeze({}));
	let scope;
	if (importer === null) {
		scope = MapMethods.get(SCOPES, instanceID);
		if (!scope) {
			scope = new Map();
			MapMethods.set(SCOPES, instanceID, scope);
		}
	} else {
		// Helpers loaded once per importing api file: that file's own copies.
		let copies = MapMethods.get(COPIES, instanceID);
		if (!copies) MapMethods.set(COPIES, instanceID, (copies = new Map()));
		const copyKey = helperCopyKey(importer, mount);
		scope = MapMethods.get(copies, copyKey);
		if (!scope) MapMethods.set(copies, copyKey, (scope = new Map()));
	}
	const owned = (file) => file === resolved || isInstanceScopedFile(file, resolved);
	const keep = (file) => !(fresh && file === resolved);

	// Set aside every global entry the require must not share, then serve this instance's copies.
	const setAside = new Map();
	for (let ofIndex = 0, ofList = Objects.keys(cache); ofIndex < ofList.length; ofIndex++) {
		const file = ofList[ofIndex];
		if (owned(file)) {
			MapMethods.set(setAside, file, cache[file]);
			delete cache[file];
		}
	}
	const served = [];
	for (const ofEntry of mapEntries(scope)) {
		const file = ofEntry[0],
			mod = ofEntry[1];
		if (!keep(file)) continue;
		if (cache[file] !== undefined) MapMethods.set(setAside, file, cache[file]);
		cache[file] = mod;
		listPush(served, file);
	}

	if (fresh) {
		// A leaf is not kept in the scope (it is evaluated anew each load), but its frames are the instance's code.
		if (!MapMethods.has(LEAVES, instanceID)) MapMethods.set(LEAVES, instanceID, new Set());
		SetMethods.add(MapMethods.get(LEAVES, instanceID), resolved);
	}
	ACTIVE = { instanceID, anchor: resolved, importer, mount, fresh };
	try {
		return requireFn(resolved);
	} finally {
		ACTIVE = outer;
		recordScopeRequires(instanceID, cache, owned);
		// Collect this instance's (possibly new) copies, then put the global cache back.
		for (let ofIndex = 0, ofList = concatLists(filterList(Objects.keys(cache), owned), served); ofIndex < ofList.length; ofIndex++) {
			const file = ofList[ofIndex];
			if (!(file in cache)) continue;
			if (keep(file)) MapMethods.set(scope, file, cache[file]);
			delete cache[file];
		}
		for (const ofEntry of mapEntries(setAside)) {
			const file = ofEntry[0],
				mod = ofEntry[1];
			cache[file] = mod;
		}
	}
}

/**
 * How an instance's scope loads a CommonJS file Node is loading (see {@link scopeRequire}): `"leaf"` for the file the
 * scope is loading as its leaf, `"helper"` for any other file required while a scope is active (a helper file, or a
 * leaf's file an api file requires itself, before or after slothlet loads that leaf), null outside every scope.
 * @param {string} url - The file's URL.
 * @returns {"leaf"|"helper"|null} How it loads.
 * @private
 */
function scopeLoadKind(url) {
	const active = ACTIVE;
	if (active === null) return null;
	let filePath;
	try {
		filePath = NODE.url.fileURLToPath(splitQuery(url)[0]);
	} catch {
		return null;
	}
	return active.fresh && filePath === active.anchor ? "leaf" : "helper";
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
	for (let ofIndex = 0, ofList = Objects.keys(cache); ofIndex < ofList.length; ofIndex++) {
		const file = ofList[ofIndex];
		if (!owned(file)) continue;
		const children = cache[file]?.children;
		if (!Arrays.isArray(children) || WeakMapMethods.get(RECORDED_REQUIRES, cache[file]) === children.length) continue;
		WeakMapMethods.set(RECORDED_REQUIRES, cache[file], children.length);
		for (let ofIndex = 0, ofList = children; ofIndex < ofList.length; ofIndex++) {
			const child = ofList[ofIndex];
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
function instanceImporters(instanceID) {
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
function instanceCommonJSFiles(instanceID) {
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
function instanceCommonJSVersion(instanceID) {
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
	MapMethods.delete(SCOPES, instanceID);
	MapMethods.delete(COPIES, instanceID);
	MapMethods.delete(LEAVES, instanceID);
	MapMethods.delete(SCOPE_KEYS, instanceID);
	MapMethods.delete(IMPORT_GRAPHS, instanceID);
	MapMethods.delete(GRAPH_VIEWS, instanceID);
	MapMethods.delete(CLAIMS, instanceID);
	SetMethods.delete(OWN_CLAIMS, instanceID);
	for (const ofEntry of mapEntries(TICKETS)) {
		const ticket = ofEntry[0],
			held = ofEntry[1];
		if (held.instanceID === instanceID) MapMethods.delete(TICKETS, ticket);
	}
	// The scripts this copy recorded for the instance's own copies of its files go with it (#597).
	for (
		let ofIndex = 0, ofList = concatLists(mapKeysToArray(LOADED_SCRIPTS), mapKeysToArray(HELPER_SCRIPTS));
		ofIndex < ofList.length;
		ofIndex++
	) {
		const key = ofList[ofIndex];
		if (scriptKeyInstance(key) !== String(instanceID)) continue;
		MapMethods.delete(LOADED_SCRIPTS, key);
		MapMethods.delete(LOADED_TEXTS, key);
		MapMethods.delete(SEALS, key);
		MapMethods.delete(HELPER_SCRIPTS, key);
		MapMethods.delete(HELPER_SEALS, key);
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
	if (typeof instanceID !== "string" || instanceID === "" || MapMethods.has(CLAIMS, instanceID)) return null;
	// What a URL carrying the ID had recorded before the ID was claimed is not the claimer's.
	if (MapMethods.has(SCOPE_KEYS, instanceID) || MapMethods.has(IMPORT_GRAPHS, instanceID)) releaseScope(instanceID);
	const handle = Objects.freeze({
		instanceID,
		require: (filePath, options) => {
			if (MapMethods.get(CLAIMS, instanceID) !== handle) throw new TypeError(`The files of instance "${instanceID}" have been released.`);
			return scopeRequire(filePath, instanceID, options);
		},
		release: () => {
			if (MapMethods.get(CLAIMS, instanceID) === handle) releaseScope(instanceID);
		}
	});
	MapMethods.set(CLAIMS, instanceID, handle);
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
function claimInstanceScope(instanceID) {
	const handle = sharedState().claim(instanceID) ?? null;
	// Claimed by this copy's own slothlet: its files are given this copy's runtime (see isOtherCopysFile).
	if (handle && isKeeper()) SetMethods.add(OWN_CLAIMS, instanceID);
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
	let handle = MapMethods.get(UNHELD, instanceID);
	if (!handle) {
		handle = claimInstanceScope(instanceID);
		if (!handle) throw new TypeError(`The files of instance "${instanceID}" are loaded by the instance alone.`);
		MapMethods.set(UNHELD, instanceID, handle);
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
function requireInInstance(filePath, instanceID, options) {
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
function releaseInstanceScope(instanceID) {
	if (instanceID == null) return;
	const handle = MapMethods.get(UNHELD, instanceID);
	if (handle) {
		MapMethods.delete(UNHELD, instanceID);
		handle.release();
		return;
	}
	if (isKeeper() && !MapMethods.has(CLAIMS, instanceID)) releaseScope(instanceID);
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
	const requireFn = NODE.module.createRequire(import.meta.url);
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
	const cache = NODE.module.createRequire(import.meta.url).cache;
	for (let ofIndex = 0, ofList = [stub?.id, stub?.filename]; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (typeof key === "string" && cache[key] === stub) delete cache[key];
	}
	if (format === "module") return requireESM(url);
	const unpacked4 = splitQuery(url),
		base = unpacked4[0],
		query = unpacked4[1] === undefined ? "" : unpacked4[1];
	const params = new URLSearchParams(query);
	return scopeRequire(NODE.url.fileURLToPath(base), URLSearchParamsMethods.get(params, "slothlet_instance"), {
		importer: helperCopyImporter(params),
		mount: URLSearchParamsMethods.get(params, HELPERS_MOUNT_PARAM)
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
	MapMethods.set(TICKETS, ticket, { instanceID, job });
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
	const held = MapMethods.get(TICKETS, ticket);
	if (!held) throw new TypeError("This code was not generated by slothlet's load hook for this load.");
	MapMethods.delete(TICKETS, ticket);
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
function setCallerCheck(check) {
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
	// Made by slothlet's own realm where there is one (see helpers/stack-read), whatever the global stack settings hold.
	const entry = unreadError(64);
	const location = entry === null ? null : (CALLER_CHECK?.(entry) ?? null);
	if (typeof location === "string") {
		const unpacked5 = splitQuery(location),
			base = unpacked5[0],
			query = unpacked5[1] === undefined ? "" : unpacked5[1];
		const params = new URLSearchParams(query);
		if (
			toSlashPath(base) === toSlashPath(String(filePath)) &&
			URLSearchParamsMethods.get(params, "slothlet_instance") === instanceID &&
			instanceID
		) {
			return scopeRequire(filePath, instanceID, {
				importer: helperCopyImporter(params),
				mount: URLSearchParamsMethods.get(params, HELPERS_MOUNT_PARAM)
			});
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
	return Arrays.isArray(conditions)
		? ArrayMethods.includes(conditions, name)
		: conditions instanceof Set
			? SetMethods.has(conditions, name)
			: false;
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
	if (
		typeof url !== "string" ||
		!StringMethods.startsWith(url, "file:") ||
		StringMethods.includes(url, "?") ||
		RegExpMethods.exec(/\.(?:cjs|json|node)$/, url) !== null
	)
		return result;
	if (!hasCondition(context?.conditions, "require")) return result;
	const parent = context.parentURL;
	if (typeof parent !== "string" || !isInstanceScopedFile(parent, active.anchor) || !belongsToInstance(specifier, url, parent))
		return result;
	const query = new URLSearchParams({ slothlet_instance: active.instanceID });
	// Inside the copies of one api file (`helpers: "module"`), the ES module is that file's copy too.
	if (active.importer) {
		URLSearchParamsMethods.set(query, HELPERS_PARAM, HELPERS_PER_MODULE);
		URLSearchParamsMethods.set(query, HELPERS_FOR_PARAM, active.importer);
		if (active.mount) URLSearchParamsMethods.set(query, HELPERS_MOUNT_PARAM, active.mount);
	}
	URLSearchParamsMethods.set(query, REQUIRE_PARAM, "1");
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
	const { readFileSync } = NODE.fs;
	const { createRequire } = NODE.module;
	const text =
		source == null
			? readFileSync(filePath, "utf8")
			: typeof source === "string"
				? source
				: TextDecoderMethods.decode(new TextDecoder(), source);
	const names = setFrom(
		commonJSExportNames(filePath, text, {
			readFile: (file) => readFileSync(file, "utf8"),
			resolve: (specifier, fromFile) => createRequire(fromFile).resolve(specifier)
		})
	);
	// Like Node, a module that has already run contributes the keys it actually exports.
	const loadedIn =
		importer === null
			? MapMethods.get(SCOPES, instanceID)
			: MapMethods.get(COPIES, instanceID) == null
				? undefined
				: MapMethods.get(MapMethods.get(COPIES, instanceID), helperCopyKey(helperImporterPath(importer), mount));
	const loaded = loadedIn == null ? undefined : MapMethods.get(loadedIn, filePath);
	if (loaded?.loaded && loaded.exports !== null && (typeof loaded.exports === "object" || typeof loaded.exports === "function")) {
		for (let ofIndex = 0, ofList = Objects.keys(loaded.exports); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (key !== "default" && StringMethods.isWellFormed(key)) SetMethods.add(names, key);
		}
	}
	SetMethods.delete(names, "module.exports");
	const lines = [
		`const m = ${entry}.requireCJS(${JSON.stringify(filePath)}, ${JSON.stringify(instanceID)}${
			importer === null ? "" : `, ${JSON.stringify(importer)}, ${JSON.stringify(mount)}`
		});`,
		"export default m;",
		'export { m as "module.exports" };'
	];
	let n = 0;
	for (const name of setValues(names)) {
		listPush(lines, `const n${n} = m == null ? undefined : m[${JSON.stringify(name)}];`, `export { n${n} as ${JSON.stringify(name)} };`);
		n++;
	}
	return ArrayMethods.join(lines, "\n") + "\n";
}

/**
 * The api file a helper copy's URL says it was loaded for (see {@link HELPERS_PARAM}), or null for a helper loaded
 * once per instance.
 * @param {URLSearchParams} params - The URL's query.
 * @returns {string|null} The api file's path.
 * @private
 */
function helperCopyImporter(params) {
	return URLSearchParamsMethods.get(params, HELPERS_PARAM) === HELPERS_PER_MODULE
		? URLSearchParamsMethods.get(params, HELPERS_FOR_PARAM)
		: null;
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
	if (StringMethods.startsWith(url, ESM_PREFIX)) {
		const target = JSON.stringify(StringMethods.slice(url, ESM_PREFIX.length));
		return { format: "module", shortCircuit: true, source: `import * as ns from ${target};\nexport { ns as "module.exports" };\n` };
	}
	if (StringMethods.startsWith(url, FACADE_PREFIX)) {
		const target = JSON.stringify(StringMethods.slice(url, FACADE_PREFIX.length));
		return {
			format: "module",
			shortCircuit: true,
			source: `export * from ${target};\nexport { default } from ${target};\nexport const __esModule = true;\n`
		};
	}
	const result = nextLoad(url, context);
	if (!StringMethods.startsWith(url, "file:")) return result;
	const unpacked6 = splitQuery(url),
		base = unpacked6[0],
		query = unpacked6[1] === undefined ? "" : unpacked6[1];
	const params = new URLSearchParams(query);
	// A CommonJS file's source is recorded as it is loaded, as an ES module's is below (#597) — but not a package's
	// under `node_modules` as written: frame placement hashes such a file from disk when it needs to.
	if (shouldRecordCommonJS(base, result)) recordLoadedSource(url, result);
	if (URLSearchParamsMethods.has(params, MODULE_REQUIRE_PARAM)) {
		// require() made by an instance's ES module: the instance's copy, from a stub that leaves Node's cache (#755).
		URLSearchParamsMethods.delete(params, MODULE_REQUIRE_PARAM);
		const target = `${base}?${params}`;
		const format = result?.format === "module" || result?.format === "module-typescript" ? "module" : "commonjs";
		const ticket = mintTicket(URLSearchParamsMethods.get(params, "slothlet_instance"), (stub) => requireFromModule(target, format, stub));
		return {
			format: "commonjs",
			shortCircuit: true,
			source: `module.exports = ${STATE_REF}.redeem(${JSON.stringify(ticket)}).requireFromModule(${JSON.stringify(target)}, ${JSON.stringify(format)}, module);\n`
		};
	}
	if (URLSearchParamsMethods.has(params, REQUIRE_PARAM)) {
		// require() of a file in an instance scope: an ES module is served the instance's copy;
		// anything else is CommonJS (or JSON/addon) and already served by the scope's private cache.
		if (result?.format !== "module") return result;
		URLSearchParamsMethods.delete(params, REQUIRE_PARAM);
		const target = `${base}?${params}`;
		const ticket = mintTicket(URLSearchParamsMethods.get(params, "slothlet_instance"), () => requireESM(target));
		return {
			format: "commonjs",
			shortCircuit: true,
			source: `module.exports = ${STATE_REF}.redeem(${JSON.stringify(ticket)}).requireESM(${JSON.stringify(target)});\n`
		};
	}
	const instanceID = URLSearchParamsMethods.get(params, "slothlet_instance");
	if ((result?.format === "module" || result?.format === "module-typescript") && instanceID !== null) return sealLoadedSource(url, result);
	if (result?.format !== "commonjs" || instanceID === null) return result;
	const filePath = NODE.url.fileURLToPath(base);
	const importer = helperCopyImporter(params);
	const mount = URLSearchParamsMethods.get(params, HELPERS_MOUNT_PARAM);
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
	return isTypeScriptLoad(result) || !(RegExpMethods.exec(/\/node_modules\//, splitQuery(url)[0]) !== null);
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
	const index = ArrayMethods.indexOf(hashes, hash);
	if (index !== -1) listSplice(hashes, index, 1);
	listPush(hashes, hash);
	if (hashes.length > SCRIPTS_PER_KEY) listSplice(hashes, 0, hashes.length - SCRIPTS_PER_KEY);
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
function setScriptKey(keyOf) {
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
 * @param {boolean} [helper=false] - A helper load of the file (see {@link HELPER_SCRIPTS}): its hash is listed there.
 * @returns {void}
 * @private
 */
function recordLoadedSource(url, result, helper = false) {
	let text = loadedText(result);
	if (text === null) return;
	if (isTypeScriptLoad(result)) {
		const strip = STRIP_TYPESCRIPT_TYPES;
		// The stripping Node does to compile the file, done here without the notice the API itself gives on first use. The
		// notice goes through the current `process.emitWarning`, so that is the one silenced here.
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
	// A helper load is listed apart from the file's own loads (see HELPER_SCRIPTS).
	const lists = helper ? HELPER_SCRIPTS : LOADED_SCRIPTS;
	let hashes = MapMethods.get(lists, key);
	if (!hashes) MapMethods.set(lists, key, (hashes = []));
	rememberNewest(hashes, hash);
	// The text itself, for where each leaf's function sits in it (see LOADED_TEXTS); only the sources still listed.
	let texts = MapMethods.get(LOADED_TEXTS, key);
	if (!texts) MapMethods.set(LOADED_TEXTS, key, (texts = new Map()));
	MapMethods.set(texts, hash, text);
	const own = MapMethods.get(LOADED_SCRIPTS, key) ?? [];
	const helpers = MapMethods.get(HELPER_SCRIPTS, key) ?? [];
	for (const known of mapKeys(texts))
		if (!ArrayMethods.includes(own, known) && !ArrayMethods.includes(helpers, known)) MapMethods.delete(texts, known);
}

/**
 * A load result's source as the text the engine compiles: decoded as UTF-8, without a byte-order mark, which both
 * loaders drop.
 * @param {{source?: string|ArrayBufferView|ArrayBuffer}|undefined} result - The load hook's result.
 * @returns {string|null} The text, or null when the result carries none.
 * @private
 */
function loadedText(result) {
	const source = result?.source;
	if (typeof source === "string") return StringMethods.charCodeAt(source, 0) === 0xfeff ? StringMethods.slice(source, 1) : source;
	if (source !== undefined && source !== null && (ArrayBuffers.isView(source) || source instanceof ArrayBuffer)) return HOST.decode(source);
	return null;
}

/**
 * Give a source slothlet loads for an instance a comment no one else can write, at its end, and record it (see
 * {@link recordLoadedSource}). V8 reports a frame's script by the hash of the text it compiled, and anyone can read a
 * file and compile it again under its name (`vm.compileFunction`, `Module#_compile`, `vm.SourceTextModule`): the
 * comment, a random value drawn for the file's script key (see {@link SEALS}), makes the script slothlet loaded hash
 * as no copy made from the file can (#691). It ends the text, so no line or column of the file's own code moves.
 * @param {string} url - The module URL, query included.
 * @param {object} result - The load hook's result.
 * @param {boolean} [helper=false] - A helper load of the file (see {@link HELPER_SCRIPTS}), sealed with the key's helper
 *   value.
 * @returns {object} The result to hand on: the sealed source, or the result as it was when it carries no source text.
 * @private
 */
function sealLoadedSource(url, result, helper = false) {
	const text = loadedText(result);
	if (text === null) return result;
	const key = scriptKeyOf(url);
	const seals = helper ? HELPER_SEALS : SEALS;
	let seal = MapMethods.get(seals, key);
	if (seal === undefined) MapMethods.set(seals, key, (seal = HOST.randomUUID()));
	const sealed = { ...result, source: `${text}\n/* ${seal} */\n` };
	recordLoadedSource(url, sealed, helper);
	return sealed;
}

/**
 * Whether sources are recorded for a script key, and whether a given one is among them (see
 * {@link recordLoadedSource}), and, when it is, whether it is a helper load of the file (see {@link HELPER_SCRIPTS}).
 * @param {string} key - The script key.
 * @param {string} [hash] - A script's hash.
 * @returns {{known: boolean, has: boolean, helper?: boolean}} The answer.
 * @internal
 */
function loadedScriptLookup(key, hash) {
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
function loadedScriptText(key, hash) {
	return sharedState().scripts.text(key, hash);
}

/**
 * The URLs of the files that import a package file, as the resolve hook recorded them (#597).
 * @param {string} path - The package file's path.
 * @returns {Array<string>} The importers' URLs.
 * @internal
 */
function packageImporters(path) {
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
function recordedScriptHashes(url) {
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
function scriptKeyInstance(key) {
	return splitText(key, "\u0000")[1] || null;
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
	if (typeof parentURL === "string" && StringMethods.includes(parentURL, MARKER)) {
		const url = propagateInstanceQuery(specifier, parentURL, result?.url);
		// The child is the instance's own copy: an edge of its import graph.
		if (typeof url === "string" && StringMethods.includes(url, MARKER)) {
			const instanceID = URLSearchParamsMethods.get(new URLSearchParams(splitQuery(parentURL)[1] ?? ""), "slothlet_instance");
			if (instanceID) recordImport(instanceID, parentURL, url);
			// A require() the module makes itself (`createRequire`): marked, so the load hook serves the instance's copy
			// without leaving it in Node's require cache, which is keyed on the file's path alone (#755). Node reads a JSON
			// file and an addon by their extension, whatever a hook answers, so those load as before: once per process.
			if (
				StringMethods.startsWith(url, "file:") &&
				hasCondition(context?.conditions, "require") &&
				!(RegExpMethods.exec(/\.(?:json|node)$/, splitQuery(url)[0]) !== null)
			) {
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
	if (
		typeof parentURL === "string" &&
		StringMethods.startsWith(parentURL, "file:") &&
		typeof url === "string" &&
		StringMethods.startsWith(url, "file:")
	) {
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
function installInstanceImportHooks(nodeModule, registry = globalThis) {
	if (registry !== globalThis) {
		// A registry of the caller's own: this copy's hooks, registered once per registry.
		if (registry[INSTALLED]) return true;
		const { registerHooks } = moduleMembers(nodeModule);
		if (typeof registerHooks !== "function") return false;
		Reflect.apply(registerHooks, nodeModule, [HOOKS]);
		Objects.defineProperty(registry, INSTALLED, { __proto__: null, value: true, enumerable: false });
		return true;
	}
	// The hooks read what slothlet keeps about each instance's files, so they are the keeping copy's.
	if (!isKeeper()) return sharedState().hooks() === true;
	if (HOOKED) return true;
	const { registerHooks } = moduleMembers(nodeModule);
	if (typeof registerHooks !== "function") return false;
	Reflect.apply(registerHooks, nodeModule, [HOOKS]);
	HOOKED = true;
	holdRequireResolve(nodeModule);
	return true;
}

/**
 * The path a probe `require.resolve()` names while {@link holdRequireResolve} checks whether Node asks the resolve hook
 * for one, and whether the hook was asked.
 * @type {{path: ?string, seen: boolean}}
 * @private
 */
const RESOLVE_PROBE = { path: null, seen: false };

/**
 * Hold a `require.resolve()` to the rule of {@link refuseInternalImport} where Node does not ask the resolve hook for
 * one: Node 22 runs the hooks `module.registerHooks()` registers for a `require()` alone, later versions for a
 * `require.resolve()` too. There, Node's own CommonJS resolution (`Module._resolveFilename`, which every
 * `require.resolve()` reaches) is wrapped: a module's code naming one of slothlet's own files is refused, as the hook
 * refuses it elsewhere. A resolution the hook is answering is left to the hook, and one Node already asks the hook for
 * is not wrapped at all.
 * @param {object} nodeModule - The `node:module` namespace.
 * @returns {void}
 * @private
 */
function holdRequireResolve(nodeModule) {
	const { Module, createRequire } = moduleMembers(nodeModule);
	// Node's loader state, patched on purpose: read as it is now.
	const original = Module?._resolveFilename;
	/* v8 ignore next -- defensive: every Node with `registerHooks()` has both; a stand-in `node:module` may not. */
	if (typeof original !== "function" || typeof createRequire !== "function") return;
	const { fileURLToPath, pathToFileURL } = NODE.url;
	const own = fileURLToPath(import.meta.url);
	RESOLVE_PROBE.path = own;
	try {
		createRequire(import.meta.url).resolve(own);
	} finally {
		RESOLVE_PROBE.path = null;
	}
	if (RESOLVE_PROBE.seen) return;
	/* v8 ignore start -- runs on Node 22 only, whose hooks are not asked for a `require.resolve()`; the coverage run uses a later Node (the Node 22 CI leg runs it through isolation/internal-imports). */
	Module._resolveFilename = function _resolveFilename(request, parent) {
		const filename = Reflect.apply(original, this, arguments);
		if (typeof filename === "string" && isSlothletInternal(filename)) {
			const parentURL = typeof parent?.filename === "string" ? pathToFileURL(parent.filename).href : undefined;
			if (isModuleImport(parentURL, ["require"])) throw importRefusal(request, filename);
		}
		return filename;
	};
	/* v8 ignore stop */
}

/**
 * The hooks {@link installInstanceImportHooks} registers.
 * @type {{resolve: Function, load: Function}}
 * @private
 */
const HOOKS = Objects.freeze({
	resolve: (specifier, context, nextResolve) => {
		if (RESOLVE_PROBE.path !== null && specifier === RESOLVE_PROBE.path) RESOLVE_PROBE.seen = true;
		// The two virtual modules behind require(esm) (#534) resolve to themselves.
		if (
			StringMethods.startsWith(specifier, ESM_PREFIX) ||
			StringMethods.startsWith(specifier, FACADE_PREFIX) ||
			StringMethods.startsWith(specifier, OWN_MODULE_PREFIX) ||
			StringMethods.startsWith(specifier, SELF_PREFIX)
		) {
			return { url: specifier, format: "module", shortCircuit: true };
		}
		refuseCodeImport(specifier, context?.parentURL ?? null, context?.conditions);
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
		// An instance's file asking for a runtime entry file: the module that gives it the instance's own `self` (#803).
		if (ArrayMethods.includes(SINGLE_COPY_FILES, url) && MapMethods.has(SELF_FORMS, url) && !isOtherCopysFile(context?.parentURL)) {
			const instanceID = selfInstanceOf(context?.parentURL);
			if (instanceID !== null) return { url: `${SELF_PREFIX}${instanceID}|${url}`, format: "module", shortCircuit: true };
		}
		if (MapMethods.has(OWN_MODULES, url) && !SetMethods.has(NODE_LOADED, url) && !isOtherCopysFile(context?.parentURL)) {
			return { ...resolved, url: OWN_MODULE_PREFIX + url, format: "module" };
		}
		return resolved;
	},
	// Only instance-marked URLs are touched; every other load passes straight through, a CommonJS file's
	// source hash recorded on the way (#597).
	load: (url, context, nextLoad) => {
		// An instance's require() of a file no instance tags: the file's one module, from a stub that leaves Node's caches.
		if (StringMethods.startsWith(url, SHARED_REQUIRE_PREFIX)) {
			const target = StringMethods.slice(url, SHARED_REQUIRE_PREFIX.length);
			const ticket = mintTicket(null, (stub) => requireShared(target, stub));
			return {
				format: "commonjs",
				shortCircuit: true,
				source: `module.exports = ${STATE_REF}.redeem(${JSON.stringify(ticket)}).requireFromModule(${JSON.stringify(target)}, "commonjs", module);\n`
			};
		}
		// A runtime entry file as an instance's file is given it (#803).
		if (StringMethods.startsWith(url, SELF_PREFIX)) {
			const selfParts = splitText(StringMethods.slice(url, SELF_PREFIX.length), "|");
			const instanceID = selfParts[0],
				file = selfParts[1];
			return { format: "module", shortCircuit: true, source: selfModuleSource(instanceID, file) };
		}
		// One of slothlet's runtime entry files, evaluated through another loader: the module that re-exports it (#760).
		if (StringMethods.startsWith(url, OWN_MODULE_PREFIX)) {
			return { format: "module", shortCircuit: true, source: ownModuleBridge(StringMethods.slice(url, OWN_MODULE_PREFIX.length)) };
		}
		// Node loading one of those files before this copy has evaluated it is loading this copy's own.
		if (ArrayMethods.includes(SINGLE_COPY_FILES, url) && !MapMethods.has(OWN_MODULES, url)) SetMethods.add(NODE_LOADED, url);
		if (StringMethods.includes(url, MARKER)) return loadInstanceModule(url, context, nextLoad);
		const result = nextLoad(url, context);
		// A CommonJS file an instance's scope loads is recorded as it loads (#597). A `require()` of the file anywhere else
		// is another module of the file (#691). A leaf's file an api file requires itself is a helper of that file's.
		const kind = StringMethods.startsWith(url, "file:") ? scopeLoadKind(url) : null;
		if (kind !== null && shouldRecordCommonJS(url, result)) return sealLoadedSource(url, result, kind === "helper");
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
	if (StringMethods.endsWith(filePath, ".cjs")) return true;
	if (!StringMethods.endsWith(filePath, ".js")) return false;
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
		const source = regExpReplace(/^#!.*/, host.readFile(filePath, "utf8"), "");
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
const OWN_TREE = concatLists(
	OWN_PREFIXES,
	mapList(
		filterList([new URL("../../", import.meta.url)], (u) => URLMethods.protocol(u) === "file:"),
		(u) => toSlashPath(URLMethods.href(u))
	)
);

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
	const loadedBy = `import ${JSON.stringify(LOADED_BY_SPECIFIER + URLSearchParamsMethods.toString(new URLSearchParams({ id })))};`;
	return { code: `${code}\n;${SCRIPT_REGISTRATION}\n${loadedBy}\n`, map: null };
}

/**
 * The statement that registers the script vite compiled a file into (#714): it pushes an `Error` the file's own
 * top-level code creates. Once slothlet fixed the registry in place, its `push` ignores what it is handed and captures the
 * stack itself, from slothlet's own realm.
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
	const unpacked7 = splitQuery(id),
		base = unpacked7[0];
	const path = toSlashPath(base);
	if (
		!(RegExpMethods.exec(/^(?:\/|[a-z]:\/)/i, path) !== null) ||
		!(RegExpMethods.exec(MODULE_FILE, path) !== null) ||
		StringMethods.includes(path, "/node_modules/")
	)
		return false;
	if (
		ArrayMethods.some(OWN_TREE, (own) => path === own || StringMethods.startsWith(path, StringMethods.endsWith(own, "/") ? own : `${own}/`))
	)
		return false;
	return !isCommonJSFile(path);
}

/**
 * Whether a module id is a file under `node_modules`, of an absolute path: a package's file, which vite does not
 * transform (see {@link isRegisteredFile}), so the record of who loaded it is written into the importer instead.
 * @param {string} id - The module id.
 * @returns {boolean} True when it is.
 * @private
 */
function isPackageFile(id) {
	const path = toSlashPath(splitQuery(id)[0]);
	return RegExpMethods.exec(/^(?:\/|[a-z]:\/)/i, path) !== null && StringMethods.includes(path, "/node_modules/");
}

/**
 * The code of the virtual module that records who loaded a file (#714): it hands the registry the importers' ids as
 * JSON, and the registry captures the stack itself, from slothlet's own realm; before slothlet fixed the registry in
 * place, it pushes an `Error` frozen with the importers as its message instead. The plugin writes the code, from the
 * imports it resolved, so no file's code can say what it says; slothlet reads the file it is about from the frame of the
 * virtual module's own code.
 * @param {Array<string>} importers - The ids of the modules recorded as loading the file.
 * @returns {string} The code.
 * @private
 */
function loadedBySource(importers) {
	const registry = `globalThis[Symbol.for(${JSON.stringify(VITE_LOADED_BY)})]`;
	const json = JSON.stringify(JSON.stringify(importers));
	// Once slothlet fixed the registry, `record` takes the importers and captures the stack itself; before, an Error is
	// pushed for slothlet to read when it loads.
	return `const registry = ${registry};\nif (typeof registry?.record === "function") registry.record(${json});\nelse (${registry} ??= []).push(Object.freeze(new Error(${json})));\n`;
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
 * // vitest.config.mjs — consumers import it as `plugin` from @cldmv/slothlet/vite
 * import { plugin } from "@cldmv/slothlet/vite";
 * export default defineConfig({ plugins: [plugin()] });
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
		if (!resolved || resolved.external || typeof resolved.id !== "string" || StringMethods.includes(resolved.id, MARKER)) return;
		const path = toSlashPath(splitQuery(resolved.id)[0]);
		if (
			!(RegExpMethods.exec(/^(?:\/|[a-z]:\/)/i, path) !== null) ||
			ArrayMethods.some(
				OWN_TREE,
				(own) => path === own || StringMethods.startsWith(path, StringMethods.endsWith(own, "/") ? own : `${own}/`)
			)
		)
			return;
		let importers = MapMethods.get(moduleImporters, resolved.id);
		if (!importers) MapMethods.set(moduleImporters, resolved.id, (importers = new Set()));
		SetMethods.add(importers, importer);
		// Through a file a module loaded, the modules that loaded it: a file under `node_modules` gets no record of its own.
		for (const through of setValues(MapMethods.get(moduleImporters, importer))) SetMethods.add(importers, through);
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
		const loaded = URLSearchParamsMethods.get(params, "id");
		const by = URLSearchParamsMethods.get(params, "by");
		if (loaded === null) return false;
		if (by !== null)
			return (
				(MapMethods.get(moduleImporters, loaded) == null ? undefined : SetMethods.has(MapMethods.get(moduleImporters, loaded), by)) === true
			);
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
		typeof importer === "string" && isOwnRecordQuery(StringMethods.slice(source, LOADED_BY_SPECIFIER.length), importer);
	/**
	 * Whether an importer is a module's code (see {@link refuseInternalImport}): an instance file, or a file a module
	 * loaded that no instance tags, outside `node_modules` and outside slothlet's own files.
	 * @param {string} importer - The importing module's id.
	 * @returns {boolean} True for a module's code.
	 */
	const isModuleImporter = (importer) =>
		StringMethods.includes(importer, MARKER) ||
		SetMethods.has(moduleFiles, toSlashPath(importer)) ||
		(MapMethods.has(moduleImporters, importer) &&
			!(RegExpMethods.exec(/\/node_modules\//, toSlashPath(importer)) !== null) &&
			slothletCodePath(importer) === null);
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
	const checkName = HOST === null ? "0" : regExpReplace(/-/g, HOST.randomUUID(), "");
	return {
		name: "slothlet-instance-imports",
		enforce: "pre",
		/**
		 * Put slothlet's worker setup first in the project's `setupFiles` (see
		 * {@link module:@cldmv/slothlet/helpers/vitest-worker-setup}): it runs in each worker before any other setup file
		 * and any test file, and records the code vitest's server sends, so vitest's own compile of a module file is told
		 * from module code's.
		 * @param {{project: {config: {setupFiles: string[]}}}} context - vitest's plugin context.
		 * @returns {void}
		 */
		configureVitest({ project }) {
			if (NODE === null) return;
			const setup = NODE.url.fileURLToPath(new URL("./vitest-worker-setup.mjs", import.meta.url));
			const list = project?.config?.setupFiles;
			if (!Arrays.isArray(list)) return;
			const at = ArrayMethods.indexOf(list, setup);
			if (at === 0) return;
			if (at > 0) listSplice(list, at, 1);
			listUnshift(list, setup);
		},
		/**
		 * Resolve a relative/`file:` import of a slothlet leaf with the leaf's instance query, and record the files no
		 * instance tags that a module imports by such a specifier or through a file a module loaded (#714).
		 * @param {string} source - The specifier as written.
		 * @param {string|undefined} importer - The importing module's id.
		 * @param {object} [options] - Vite resolve options.
		 * @returns {Promise<object|string|null>} The resolution, or null to defer to other resolvers.
		 */
		async resolveId(source, importer, options) {
			if (typeof source === "string" && StringMethods.startsWith(source, LOADED_BY_SPECIFIER))
				return isOwnRecord(source, importer) ? `\0${source}` : NO_RECORD_ID;
			if (source === IMPORT_CHECK_SPECIFIER) return `\0${IMPORT_CHECK_SPECIFIER}`;
			if (typeof importer !== "string") return null;
			const tagged = StringMethods.includes(importer, MARKER);
			// Slothlet's own files are slothlet's: a module's code cannot import them, by any spelling that can reach them.
			if (
				isModuleImporter(importer) &&
				(isFileSpecifier(source) || StringMethods.startsWith(source, "@cldmv/slothlet") || StringMethods.startsWith(source, "#"))
			) {
				const target = await this.resolve(source, importer, { ...options, skipSelf: true });
				if (target && !target.external && isSlothletInternal(target.id)) throw await viteImportRefusal(source, target.id);
			}
			// An instance file importing a runtime entry file: the module that gives it the instance's own `self` (#803).
			if (tagged && StringMethods.startsWith(source, "@cldmv/slothlet/runtime")) {
				const target = await this.resolve(source, importer, { ...options, skipSelf: true });
				const instanceID = URLSearchParamsMethods.get(new URLSearchParams(splitQuery(importer)[1] ?? ""), "slothlet_instance");
				if (target && !target.external && instanceID && isRuntimeEntryId(target.id)) return `\0${SELF_PREFIX}${instanceID}|${target.id}`;
			}
			// An `import` statement of a `data:` or `blob:` URL in an instance file: resolved here, in the vite server, where
			// the instance's rules are not, so it is refused whatever they say (Node's resolve hook decides it by the
			// importing file's module path; a module's `import()` of one is checked where it runs, see checkModuleImport).
			if (tagged && RegExpMethods.exec(/^(?:data|blob):/i, source) !== null) throw await viteCapabilityRefusal(importer);
			// A file only the host loaded imports as vite resolves it.
			if (!tagged && !MapMethods.has(moduleImporters, importer)) return null;
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
				if (!StringMethods.includes(id, MARKER)) return hostScriptRegistration(code, id);
				const unpacked8 = splitQuery(id),
					base = unpacked8[0],
					query = unpacked8[1] === undefined ? "" : unpacked8[1];
				SetMethods.add(moduleFiles, toSlashPath(base));
				const instanceID = URLSearchParamsMethods.get(new URLSearchParams(query), "slothlet_instance");
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
						for (let ofIndex = 0, ofList = node; ofIndex < ofList.length; ofIndex++) {
							const child = ofList[ofIndex];
							visit(child);
						}
						return;
					}
					if (typeof node.type !== "string") return;
					if (node.type === "ImportExpression" && node.source) listPush(checked, node.source);
					else if (
						node.type === "CallExpression" &&
						node.callee?.type === "MemberExpression" &&
						node.callee.object?.type === "MetaProperty" &&
						node.callee.object.meta?.name === "import" &&
						node.callee.property?.name === "resolve"
					)
						listPush(checked, node);
					const isImport =
						RegExpMethods.exec(/^(?:ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration|ImportExpression)$/, node.type) !== null;
					const source = isImport ? node.source?.value : undefined;
					if (typeof source === "string" && isFileSpecifier(source)) SetMethods.add(specifiers, source);
					else if (typeof source === "string") SetMethods.add(bare, source);
					for (let ofIndex = 0, ofList = Objects.keys(node); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (key !== "type") visit(node[key]);
					}
				};
				visit(ast.body);
				// An `import` / `export … from` statement of a `data:` or `blob:` URL: refused here, where the instance's rules
				// are not (vitest's runner loads such a URL itself, so no resolve names this file as its importer).
				for (let index = 0; index < ast.body.length; index++) {
					const node = ast.body[index];
					const source =
						RegExpMethods.exec(/^(?:ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration)$/, node?.type) !== null
							? node.source?.value
							: undefined;
					if (typeof source === "string" && RegExpMethods.exec(/^(?:data|blob):/i, source) !== null) throw await viteCapabilityRefusal(id);
				}
				// A file no instance tags that the module imports by a bare specifier (a linked package, its package's own
				// `#imports`) is recorded as the module's (#714). A specifier computed at run time is not seen here.
				// The files no instance tags that the module imports, of those the plugin registers: each gets a record of its
				// own naming this module as a loader (#715). The record a file's own registration imports is written once, when
				// vite first loads it, so a module importing the file after that would go unrecorded.
				// A package's file gets that record too: vitest's runner imports a package under `node_modules` itself, so the
				// resolve hook sees the runner, not this module, import it, and only this record names the module as its loader.
				const shared = new Set();
				const noteShared = (resolved) => {
					if (!resolved || resolved.external || typeof resolved.id !== "string" || StringMethods.includes(resolved.id, MARKER)) return;
					noteModuleImport(resolved, id);
					if (isRegisteredFile(resolved.id) || isPackageFile(resolved.id)) SetMethods.add(shared, resolved.id);
				};
				const children = [];
				for (let ofIndex = 0, ofList = concatLists(setToArray(bare), setToArray(specifiers)); ofIndex < ofList.length; ofIndex++) {
					const specifier = ofList[ofIndex];
					const resolved = await this.resolve(specifier, id);
					if (resolved && !resolved.external && StringMethods.includes(resolved.id, MARKER)) listPush(children, resolved.id);
					else noteShared(resolved);
				}
				const loadedBy = ArrayMethods.join(
					mapList(
						setToArray(shared),
						(child) =>
							`\nimport ${JSON.stringify(LOADED_BY_SPECIFIER + URLSearchParamsMethods.toString(new URLSearchParams({ id: child, by: id })))};`
					),
					""
				);
				const imports = children.length
					? `\n;globalThis[Symbol.for(${JSON.stringify(SymbolMethods.description(STATE))})]?.recordImports?.(${JSON.stringify(instanceID)}, ${JSON.stringify(id)}, ${JSON.stringify(children)});`
					: "";
				// The check is imported under a name the module cannot know, at the end so no line moves (imports are hoisted).
				let body = code;
				let check = "";
				if (checked.length) {
					const name = `__slothlet_import_check_${checkName}`;
					for (let ofIndex = 0, ofList = ArrayMethods.sort(checked, (a, b) => b.start - a.start); ofIndex < ofList.length; ofIndex++) {
						const node = ofList[ofIndex];
						body = `${StringMethods.slice(body, 0, node.start)}${name}(${StringMethods.slice(body, node.start, node.end)}, import.meta.url)${StringMethods.slice(body, node.end)}`;
					}
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
			if (typeof id === "string" && StringMethods.startsWith(id, `\0${SELF_PREFIX}`)) {
				const unpacked10 = splitText(StringMethods.slice(id, 1 + SELF_PREFIX.length), "|"),
					instanceID = unpacked10[0],
					file = unpacked10[1];
				return { code: selfModuleSource(instanceID, NODE.url.pathToFileURL(splitQuery(file)[0]).href, file), map: null };
			}
			// Read once, as the module importing it loads, from the shared object that module's own code cannot replace.
			if (id === `\0${IMPORT_CHECK_SPECIFIER}`) return { code: `export const checkImport = ${STATE_REF}.checkImport;\n`, map: null };
			if (typeof id === "string" && StringMethods.startsWith(id, `\0${LOADED_BY_SPECIFIER}`)) {
				const query = StringMethods.slice(id, 1 + LOADED_BY_SPECIFIER.length);
				// A record the plugin did not resolve a module's import of the file for records nothing (#715).
				if (!isOwnRecordQuery(query)) return { code: "export {};\n", map: null };
				const params = new URLSearchParams(query);
				const by = URLSearchParamsMethods.get(params, "by");
				// A module's own record of a file it imports (#715) names that module and the modules that loaded it; a file's
				// own record, the importers resolved so far.
				const importers =
					by === null
						? setToArray(MapMethods.get(moduleImporters, URLSearchParamsMethods.get(params, "id")))
						: concatLists([by], setToArray(MapMethods.get(moduleImporters, by)));
				return { code: loadedBySource(importers), map: null };
			}
			if (typeof id !== "string" || !StringMethods.includes(id, MARKER)) return null;
			const unpacked9 = splitQuery(id),
				base = unpacked9[0],
				query = unpacked9[1] === undefined ? "" : unpacked9[1];
			const instanceID = URLSearchParamsMethods.get(new URLSearchParams(query), "slothlet_instance");
			if (instanceID === null) return null;
			// A JSON file a leaf imports carries the instance query, as under Node; vite loads no JSON file under a query of
			// its own, so it is loaded here, as Node loads a JSON module: its value as the default export (#714).
			if (RegExpMethods.exec(/\.json$/i, toSlashPath(base)) !== null)
				return { code: `export default ${JSON.stringify(JSON.parse(NODE.fs.readFileSync(base, "utf8")))};\n`, map: null };
			if (!isCommonJSFile(base)) return null;
			const params = new URLSearchParams(query);
			return {
				code: commonJSWrapperSource(
					base,
					instanceID,
					null,
					helperCopyImporter(params),
					URLSearchParamsMethods.get(params, HELPERS_MOUNT_PARAM)
				)
			};
		}
	};
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
			"lib/builders/modes-processor",
			"lib/handlers/frame-placement",
			"lib/helpers/capability-context",
			"lib/processors/loader",
			"lib/runtime/runtime",
			"lib/runtime/runtime-asynclocalstorage",
			"lib/runtime/runtime-livebindings",
			"slothlet"
		])
	)
		throw ownBindingsRefusal("lib/helpers/instance-imports", import.meta.url);
	return {
		claimInstanceScope,
		installInstanceImportHooks,
		instanceCommonJSFiles,
		instanceCommonJSVersion,
		instanceImporters,
		loadedScriptLookup,
		loadedScriptText,
		noteModuleFile,
		noteModuleRoot,
		packageImporters,
		registerOwnModule,
		registerSelfForms,
		callableSelfOf,
		bindInstanceSelf,
		closeInstanceSelf,
		SELF_BIND_KEY,
		setInstanceSelfKind,
		defaultExportLooksCallable,
		requireInInstance,
		scriptKeyInstance,
		setCallerCheck,
		setCapabilityCheck,
		setImportRefusal,
		setScriptKey
	};
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof registerOwnModule} */
const guarded_registerOwnModule = guardInternal(registerOwnModule, "registerOwnModule", import.meta.url);
/** @type {typeof noteModuleFile} */
const guarded_noteModuleFile = guardInternal(noteModuleFile, "noteModuleFile", import.meta.url);
/** @type {typeof setImportRefusal} */
const guarded_setImportRefusal = guardInternal(setImportRefusal, "setImportRefusal", import.meta.url);
/** @type {typeof instanceImporters} */
const guarded_instanceImporters = guardInternal(instanceImporters, "instanceImporters", import.meta.url);
/** @type {typeof instanceCommonJSFiles} */
const guarded_instanceCommonJSFiles = guardInternal(instanceCommonJSFiles, "instanceCommonJSFiles", import.meta.url);
/** @type {typeof instanceCommonJSVersion} */
const guarded_instanceCommonJSVersion = guardInternal(instanceCommonJSVersion, "instanceCommonJSVersion", import.meta.url);
/** @type {typeof claimInstanceScope} */
const guarded_claimInstanceScope = guardInternal(claimInstanceScope, "claimInstanceScope", import.meta.url);
/** @type {typeof requireInInstance} */
const guarded_requireInInstance = guardInternal(requireInInstance, "requireInInstance", import.meta.url);
/** @type {typeof releaseInstanceScope} */
const guarded_releaseInstanceScope = guardInternal(releaseInstanceScope, "releaseInstanceScope", import.meta.url);
/** @type {typeof setCallerCheck} */
const guarded_setCallerCheck = guardInternal(setCallerCheck, "setCallerCheck", import.meta.url);
/** @type {typeof setScriptKey} */
const guarded_setScriptKey = guardInternal(setScriptKey, "setScriptKey", import.meta.url);
/** @type {typeof loadedScriptLookup} */
const guarded_loadedScriptLookup = guardInternal(loadedScriptLookup, "loadedScriptLookup", import.meta.url);
/** @type {typeof loadedScriptText} */
const guarded_loadedScriptText = guardInternal(loadedScriptText, "loadedScriptText", import.meta.url);
/** @type {typeof packageImporters} */
const guarded_packageImporters = guardInternal(packageImporters, "packageImporters", import.meta.url);
/** @type {typeof recordedScriptHashes} */
const guarded_recordedScriptHashes = guardInternal(recordedScriptHashes, "recordedScriptHashes", import.meta.url);
/** @type {typeof scriptKeyInstance} */
const guarded_scriptKeyInstance = guardInternal(scriptKeyInstance, "scriptKeyInstance", import.meta.url);
/** @type {typeof installInstanceImportHooks} */
const guarded_installInstanceImportHooks = guardInternal(installInstanceImportHooks, "installInstanceImportHooks", import.meta.url);
export {
	guarded_registerOwnModule as registerOwnModule,
	guarded_noteModuleFile as noteModuleFile,
	guarded_setImportRefusal as setImportRefusal,
	guarded_instanceImporters as instanceImporters,
	guarded_instanceCommonJSFiles as instanceCommonJSFiles,
	guarded_instanceCommonJSVersion as instanceCommonJSVersion,
	guarded_claimInstanceScope as claimInstanceScope,
	guarded_requireInInstance as requireInInstance,
	guarded_releaseInstanceScope as releaseInstanceScope,
	guarded_setCallerCheck as setCallerCheck,
	guarded_setScriptKey as setScriptKey,
	guarded_loadedScriptLookup as loadedScriptLookup,
	guarded_loadedScriptText as loadedScriptText,
	guarded_packageImporters as packageImporters,
	guarded_recordedScriptHashes as recordedScriptHashes,
	guarded_scriptKeyInstance as scriptKeyInstance,
	guarded_installInstanceImportHooks as installInstanceImportHooks
};
