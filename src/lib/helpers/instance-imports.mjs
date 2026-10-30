/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/instance-imports.mjs
 *	@Date: 2026-09-28T20:32:55-07:00 (1790652775)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-30T23:03:47-07:00 (1793426627)
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
 * This module closes that gap for everything reachable through relative or `file:` specifiers,
 * at any depth:
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
 * What stays shared: bare specifiers (`node_modules` packages, `node:` builtins, subpath `#imports`,
 * `@cldmv/slothlet` and its runtime), any file inside a `node_modules` package other than the
 * importer's own, and slothlet's own source files — the live-binding runtime must remain one
 * module per process.
 *
 * Crossing module systems (#534). Node caches CommonJS by file path, so a query on a CommonJS URL is
 * ignored, and `require(esm)` loads an ES module under its plain file URL. Two more hooks close that:
 *
 * - **ESM → CommonJS** — a `load` hook turns an instance-marked CommonJS URL into a small ES module
 *   wrapper that runs the file through the instance's private CommonJS cache
 *   ({@link requireInInstance}, the same cache a `.cjs` leaf's own requires use). Its export names come
 *   from a static scan of the source (see `cjs-export-names.mjs`), as Node's own are.
 * - **CommonJS → ESM** — while {@link requireInInstance} runs its synchronous require, the scope is
 *   active: a relative `require()` from a file of that scope resolving to an ES module is marked, and
 *   the `load` hook answers it with a CommonJS stub that returns the ES module imported under the
 *   instance query — the same module record an ESM leaf of the instance imports.
 */

import { commonJSExportNames } from "./cjs-export-names.mjs";

/**
 * Query parameters copied from a leaf onto its helpers: the instance only. The leaf's `module`
 * (mount) and `_reload` (partial-reload stamp) parameters are deliberately NOT copied — a helper is
 * one copy per instance, shared by every mount and kept across partial reloads; a full reload
 * rotates the instance ID and so yields a fresh copy.
 * @type {ReadonlyArray<string>}
 * @internal
 */
export const INSTANCE_QUERY_KEYS = Object.freeze(["slothlet_instance"]);

/**
 * The marker a parent's URL/id must carry for its imports to be rewritten.
 * @type {string}
 * @private
 */
const MARKER = "slothlet_instance=";

/**
 * Global flag marking the Node resolve hook as registered, shared across slothlet copies.
 * @type {symbol}
 * @private
 */
const INSTALLED = Symbol.for("@cldmv/slothlet.instanceImportHooks");

/**
 * Query parameter marking a URL that a `require()` resolved inside an active instance scope (#534).
 * @type {string}
 * @private
 */
const REQUIRE_PARAM = "slothlet_require";

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
 * Global key of the process-wide state shared by every slothlet copy in the process (#534).
 * @type {symbol}
 * @private
 */
const STATE = Symbol.for("@cldmv/slothlet.instanceImportState");

/**
 * The sources this copy's load hook recorded (see {@link recordLoadedSource}), by script key, the newest
 * {@link SCRIPTS_PER_KEY} each (#597). Kept here, out of every module's reach: other slothlet copies read them through
 * the frozen reader the hook's copy fixes on the state (see {@link publishScripts}).
 * @type {Map<string, Array<string>>}
 * @private
 */
const LOADED_SCRIPTS = new Map();

/**
 * Put a value on the process-wide state that no code can change or remove afterwards. The first one put stays.
 * @param {object} state - The state.
 * @param {string} name - The property.
 * @param {*} value - The value.
 * @returns {void}
 * @private
 */
function fixOnState(state, name, value) {
	if (Object.hasOwn(state, name)) return;
	Object.defineProperty(state, name, { value, enumerable: false, writable: false, configurable: false });
}

/**
 * Fix the reader of {@link LOADED_SCRIPTS} on the process-wide state: whether a key has sources recorded and whether a
 * given one is among them, a copy of them, and how many keys have any. Nothing it offers adds or drops a source, so a
 * module reaching the state cannot have code it compiled under another file's name taken for that file (#597). Only
 * the copy that recorded them drops an instance's, when it shuts down.
 * @param {InstanceImportState} state - The state.
 * @returns {void}
 * @private
 */
function publishScripts(state) {
	fixOnState(
		state,
		"scripts",
		Object.freeze({
			lookup: (key, hash) => {
				const hashes = LOADED_SCRIPTS.get(key);
				return { known: Boolean(hashes?.length), has: hash !== undefined && Boolean(hashes?.includes(hash)) };
			},
			hashes: (key) => [...(LOADED_SCRIPTS.get(key) ?? [])],
			count: () => LOADED_SCRIPTS.size
		})
	);
}

/**
 * Process-wide instance-import state.
 * @typedef {object} InstanceImportState
 * @property {Map<string, Map<string, object>>} scopes - Per instance ID: the private CommonJS module
 *   copies of that instance, by filename.
 * @property {{ instanceID: string, anchor: string }|null} active - The scope a synchronous
 *   {@link requireInInstance} is running in (`anchor` is the file it required), else null.
 * @property {(filePath: string, instanceID: string) => *} requireCJS - Entry point of the ESM wrapper
 *   generated for a CommonJS helper.
 * @property {(url: string) => *} requireESM - Entry point of the CommonJS stub generated for a
 *   `require()` of an ES module.
 * @property {Map<string, Map<string, Set<string>>>} [graphs] - Per instance ID: for each file of the
 *   instance's import graph, the files that import it (forward-slash paths). Created on first use, so a
 *   state object made by an older slothlet copy gains it too.
 * @property {Map<string, Set<string>>} [leaves] - Per instance ID: the CommonJS leaves it loaded, which its
 *   private cache does not keep (each load evaluates the leaf anew). Created on first use.
 * @property {(instanceID: string, parent: string, children: string[]) => void} [recordImports] - Records a
 *   module's imports; called by the registration the vite plugin appends to each instance module.
 * @property {{lookup: Function, hashes: Function, count: Function}} [scripts] - The frozen reader of
 *   the sources the hook's copy recorded (#597), fixed on the state by that copy (see publishScripts).
 * @property {(url: string) => string} [scriptKeyOf] - How a URL is reduced to its script key, fixed once set.
 * @internal
 */

/**
 * The process-wide state, created on first use. Shared through the global object so a leaf loaded by
 * one slothlet copy and a hook registered by another agree on the same per-instance caches.
 * @returns {InstanceImportState} The state.
 * @private
 */
function sharedState() {
	let state = globalThis[STATE];
	if (state === undefined) {
		state = { scopes: new Map(), active: null, requireCJS: (filePath, instanceID) => requireInInstance(filePath, instanceID), requireESM };
		// Fixed once made, so no code can put another state object in its place.
		Object.defineProperty(globalThis, STATE, { value: state, enumerable: false, configurable: false, writable: false });
	}
	state.recordImports ??= (instanceID, parent, children) => {
		for (const child of children) recordImport(instanceID, parent, child);
	};
	return state;
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
 * Whether a module resolved at `child` (imported from `parent`) belongs to the importing leaf's
 * per-instance graph. Slothlet's own files are always shared. A file inside a `node_modules`
 * package is per instance only when the importer lives in that same package — a slothlet plugin
 * installed as a dependency keeps its own helpers per instance, while a relative path that
 * reaches into some other package does not duplicate that package.
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
	return childPkg === null || childPkg === nodeModulesPackage(toSlashPath(parent));
}

/**
 * Copy the slothlet instance query from `parent` onto `child` when the import belongs to the
 * leaf's per-instance graph; otherwise return `child` unchanged. Works on `file:` URLs (Node) and
 * on vite ids (absolute paths with an optional query) alike.
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
	if (typeof parent !== "string" || !parent.includes(MARKER)) return child;
	if (typeof child !== "string" || !isFileSpecifier(specifier)) return child;
	if (!(child.startsWith("file:") || child.startsWith("/") || /^[A-Za-z]:[\\/]/.test(child))) return child;
	const [childBase, childQuery = ""] = splitQuery(child);
	const childParams = new URLSearchParams(childQuery);
	if (childParams.has("slothlet_instance")) return child;
	if (!isInstanceScopedFile(childBase, parent)) return child;
	const parentParams = new URLSearchParams(splitQuery(parent)[1] ?? "");
	for (const key of INSTANCE_QUERY_KEYS) {
		if (parentParams.has(key)) childParams.set(key, parentParams.get(key));
	}
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
 * ID and so starts a fresh one ({@link releaseInstanceScope} drops the old one).
 *
 * While the require runs, the scope is active: a relative `require()` of an ES module from a file of
 * the scope is served the instance's copy of that module (the resolve and load hooks of
 * {@link installInstanceImportHooks}).
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance whose copies are served.
 * @param {object} [options] - Options.
 * @param {boolean} [options.fresh=false] - Evaluate the file itself anew instead of serving (and
 *   keeping) the instance's copy of it — how a leaf is loaded, so a partial reload re-runs it.
 * @returns {*} The file's `module.exports`.
 * @internal
 * @example
 * const exports = requireInInstance("/app/api/counter.cjs", "inst-a", { fresh: true });
 */
export function requireInInstance(filePath, instanceID, { fresh = false } = {}) {
	const requireFn = nodeBuiltin("node:module").createRequire(filePath);
	const resolved = requireFn.resolve(filePath);
	const cache = requireFn.cache;
	const state = sharedState();
	const outer = state.active;
	// Already inside this instance's scope (a helper reached during its require): the cache is swapped in.
	if (!fresh && outer !== null && outer.instanceID === instanceID) return requireFn(resolved);

	let scope = state.scopes.get(instanceID);
	if (!scope) {
		scope = new Map();
		state.scopes.set(instanceID, scope);
	}
	const owned = (file) => file === resolved || isInstanceScopedFile(file, resolved);
	const keep = (file) => !(fresh && file === resolved);

	// Set aside every global entry the require must not share, then serve this instance's copies.
	const setAside = new Map();
	for (const file of Object.keys(cache)) {
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
		state.leaves ??= new Map();
		if (!state.leaves.has(instanceID)) state.leaves.set(instanceID, new Set());
		state.leaves.get(instanceID).add(resolved);
	}
	state.active = { instanceID, anchor: resolved };
	try {
		return requireFn(resolved);
	} finally {
		state.active = outer;
		// Collect this instance's (possibly new) copies, then put the global cache back.
		for (const file of [...Object.keys(cache).filter(owned), ...served]) {
			if (!(file in cache)) continue;
			if (keep(file)) scope.set(file, cache[file]);
			delete cache[file];
		}
		for (const [file, mod] of setAside) cache[file] = mod;
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
	const state = sharedState();
	state.graphs ??= new Map();
	let graph = state.graphs.get(instanceID);
	if (!graph) {
		graph = new Map();
		state.graphs.set(instanceID, graph);
	}
	const childPath = toSlashPath(child);
	let parents = graph.get(childPath);
	if (!parents) {
		parents = new Set();
		graph.set(childPath, parents);
	}
	const before = parents.size;
	parents.add(toSlashPath(parent));
	// Counted on the graph, so a reader can tell it changed without walking it.
	if (parents.size !== before) graph.edges = (graph.edges ?? 0) + 1;
}

/**
 * The import graph of an instance's own code: for each file a leaf of the instance reached through an
 * import or require that carries the instance (#601 review), the files that import it. The live runtime
 * walks it upwards to tell which leaves a stack frame's code belongs to.
 * @param {string} instanceID - The instance ID.
 * @returns {Map<string, Set<string>>|null} Importers by imported file (forward-slash paths), or null.
 * @internal
 * @example
 * instanceImporters("inst-a")?.get("/app/lib/state.mjs"); // Set { "/app/api/tally.mjs" }
 */
export function instanceImporters(instanceID) {
	return globalThis[STATE]?.graphs?.get(instanceID) ?? null;
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
	const scope = globalThis[STATE]?.scopes.get(instanceID);
	const leaves = globalThis[STATE]?.leaves?.get(instanceID);
	return [...(scope ? scope.keys() : []), ...(leaves ?? [])];
}

/**
 * What a reader can key what it derived from {@link instanceCommonJSFiles} on (#601 review): an object
 * the instance's CommonJS state lives in, dropped by {@link releaseInstanceScope}, and how many files
 * the instance has. Files are only ever added while the instance lives, so an equal count means the same
 * files.
 * @param {string} instanceID - The instance ID.
 * @returns {{key: object, count: number}|null} The key and file count, or null when it has none.
 * @internal
 * @example
 * instanceCommonJSVersion("inst-a"); // { key: Set {…}, count: 3 }
 */
export function instanceCommonJSVersion(instanceID) {
	const scope = globalThis[STATE]?.scopes.get(instanceID);
	const leaves = globalThis[STATE]?.leaves?.get(instanceID);
	const key = leaves ?? scope;
	return key ? { key, count: (scope?.size ?? 0) + (leaves?.size ?? 0) } : null;
}

/**
 * Drop an instance's private CommonJS copies (#534): on shutdown, and for the old instance ID on a
 * full reload. Its ES module copies stay in Node's module cache (which has no eviction) but are no
 * longer reachable from a live instance.
 * @param {string|null|undefined} instanceID - The instance ID.
 * @returns {void}
 * @internal
 * @example
 * releaseInstanceScope(oldInstanceID);
 */
export function releaseInstanceScope(instanceID) {
	if (instanceID == null) return;
	globalThis[STATE]?.scopes.delete(instanceID);
	globalThis[STATE]?.graphs?.delete(instanceID);
	globalThis[STATE]?.leaves?.delete(instanceID);
	// The scripts this copy recorded for the instance's own copies of its files go with it (#597).
	for (const key of LOADED_SCRIPTS.keys()) if (scriptKeyInstance(key) === String(instanceID)) LOADED_SCRIPTS.delete(key);
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
 * Whether a resolve/load context's conditions include `name` (an array on the import path; a Set on
 * Node 22's require path).
 * @param {Iterable<string>|undefined} conditions - The context's conditions.
 * @param {string} name - The condition.
 * @returns {boolean} True when present.
 * @private
 */
function hasCondition(conditions, name) {
	if (conditions == null) return false;
	return typeof conditions.has === "function" ? conditions.has(name) : Array.prototype.includes.call(conditions, name);
}

/**
 * Mark a `require()` resolution made inside an active instance scope (#534): a relative require from
 * a file of the scope that resolves to a possible ES module gets the instance query plus
 * {@link REQUIRE_PARAM}, so the load hook can serve it the instance's copy. CommonJS targets are
 * already served by the scope's private cache and are left alone.
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
	if (!isFileSpecifier(specifier) || !hasCondition(context?.conditions, "require")) return result;
	const parent = context.parentURL;
	if (typeof parent !== "string" || !isInstanceScopedFile(parent, active.anchor) || !isInstanceScopedFile(url, parent)) return result;
	const query = new URLSearchParams({ slothlet_instance: active.instanceID });
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
 * @returns {string} The wrapper's ES module source.
 * @internal
 * @example
 * commonJSWrapperSource("/app/lib/state.cjs", "inst-a", null);
 */
export function commonJSWrapperSource(filePath, instanceID, source) {
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
	const loaded = globalThis[STATE]?.scopes.get(instanceID)?.get(filePath);
	if (loaded?.loaded && loaded.exports !== null && (typeof loaded.exports === "object" || typeof loaded.exports === "function")) {
		for (const key of Object.keys(loaded.exports)) if (key !== "default" && key.isWellFormed()) names.add(key);
	}
	names.delete("module.exports");
	const lines = [
		`const m = globalThis[Symbol.for(${JSON.stringify(STATE.description)})].requireCJS(${JSON.stringify(filePath)}, ${JSON.stringify(instanceID)});`,
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
	if (params.has(REQUIRE_PARAM)) {
		// require() of a file in an instance scope: an ES module is served the instance's copy;
		// anything else is CommonJS (or JSON/addon) and already served by the scope's private cache.
		if (result?.format !== "module") return result;
		params.delete(REQUIRE_PARAM);
		const target = JSON.stringify(`${base}?${params}`);
		return {
			format: "commonjs",
			shortCircuit: true,
			source: `module.exports = globalThis[Symbol.for(${JSON.stringify(STATE.description)})].requireESM(${target});\n`
		};
	}
	const instanceID = params.get("slothlet_instance");
	if ((result?.format === "module" || result?.format === "module-typescript") && instanceID !== null) recordLoadedSource(url, result);
	if (result?.format !== "commonjs" || instanceID === null) return result;
	return {
		format: "module",
		shortCircuit: true,
		source: commonJSWrapperSource(nodeBuiltin("node:url").fileURLToPath(base), instanceID, result.source)
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
	const keyOf = globalThis[STATE]?.scriptKeyOf;
	return typeof keyOf === "function" ? keyOf(url) : url;
}

/**
 * Register how a URL is reduced to the key its script hashes are kept under (see {@link scriptKeyOf}).
 * @param {function(string): string} keyOf - The URL's key.
 * @returns {void}
 * @internal
 */
export function setScriptKey(keyOf) {
	// Fixed once set: a key that could be swapped would let every location share the sources of one.
	fixOnState(sharedState(), "scriptKeyOf", keyOf);
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
	else if (ArrayBuffer.isView(source) || source instanceof ArrayBuffer) text = new TextDecoder().decode(source);
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
	const hash = nodeBuiltin("node:crypto").createHash("sha256").update(text, "utf8").digest("hex");
	const key = scriptKeyOf(url);
	let hashes = LOADED_SCRIPTS.get(key);
	if (!hashes) LOADED_SCRIPTS.set(key, (hashes = []));
	rememberNewest(hashes, hash);
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
	return globalThis[STATE]?.scripts?.lookup(key, hash) ?? { known: false, has: false };
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
	return globalThis[STATE]?.scripts?.hashes(scriptKeyOf(url)) ?? [];
}

/**
 * How many script keys have hashes recorded.
 * @returns {number} The count.
 * @internal
 * @example
 * recordedScriptCount(); // 12
 */
export function recordedScriptCount() {
	return globalThis[STATE]?.scripts?.count() ?? 0;
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
		}
		return url === result?.url ? result : { ...result, url };
	}
	const active = globalThis[STATE]?.active;
	if (!active) return result;
	// A require inside an instance's CommonJS scope (see requireInInstance): its relative files are the
	// instance's copies, so the require is an edge of the instance's graph.
	const url = result?.url;
	if (typeof parentURL === "string" && parentURL.startsWith("file:") && typeof url === "string" && url.startsWith("file:")) {
		if (isFileSpecifier(specifier) && isInstanceScopedFile(url, parentURL)) recordImport(active.instanceID, parentURL, url);
	}
	return markScopedRequire(specifier, context, result, active);
}

/**
 * Register the resolve and load hooks with Node, once per process (idempotent across slothlet copies).
 * The resolve hook copies a leaf's instance query onto its relative imports and marks relative
 * `require()`s made inside an instance scope; the load hook serves the cross-module-system cases
 * (#534) and passes every unmarked URL straight through.
 * Uses the synchronous in-thread `module.registerHooks()` (Node >= 22.15 / 23.5, slothlet's engines
 * floor). The off-thread `module.register()` is deliberately not used: it adds a cross-thread round
 * trip to every import in the process and reorders module evaluation enough to break leaves that
 * start a fire-and-forget runtime import. A host without `registerHooks()` is left untouched.
 * @param {object} nodeModule - The `node:module` namespace.
 * @param {object} [registry=globalThis] - Where the process-wide "registered" flag lives; the global
 *   object in production, so every slothlet copy in the process sees one registration.
 * @returns {boolean} True when a hook is (now or already) registered.
 * @internal
 * @example
 * installInstanceImportHooks(await import("node:module"));
 */
export function installInstanceImportHooks(nodeModule, registry = globalThis) {
	if (registry[INSTALLED]) return true;
	if (typeof nodeModule?.registerHooks === "function") {
		// The copy whose hook records the sources is the one whose reader of them every copy uses.
		publishScripts(sharedState());
		nodeModule.registerHooks({
			resolve: (specifier, context, nextResolve) => {
				// The two virtual modules behind require(esm) (#534) resolve to themselves.
				if (specifier.startsWith(ESM_PREFIX) || specifier.startsWith(FACADE_PREFIX)) {
					return { url: specifier, format: "module", shortCircuit: true };
				}
				return applyToResult(specifier, context, nextResolve(specifier, context));
			},
			// Only instance-marked URLs are touched; every other load passes straight through, a CommonJS file's
			// source hash recorded on the way (#597).
			load: (url, context, nextLoad) => {
				if (url.includes(MARKER)) return loadInstanceModule(url, context, nextLoad);
				const result = nextLoad(url, context);
				if (url.startsWith("file:") && shouldRecordCommonJS(url, result)) recordLoadedSource(url, result);
				return result;
			}
		});
	} else {
		return false;
	}
	Object.defineProperty(registry, INSTALLED, { value: true, enumerable: false });
	return true;
}

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
	const fs = nodeBuiltin("node:fs");
	const path = nodeBuiltin("node:path");
	for (let dir = path.dirname(filePath); ; dir = path.dirname(dir)) {
		const manifest = path.join(dir, "package.json");
		if (fs.existsSync(manifest)) {
			let type;
			try {
				type = JSON.parse(fs.readFileSync(manifest, "utf8"))?.type;
			} catch {
				// Malformed package.json: leave the file to the host's own loader, which reports it.
				return false;
			}
			if (type === "module" || type === "commonjs") return type === "commonjs";
			break;
		}
		if (path.dirname(dir) === dir || path.basename(dir) === "node_modules") break;
	}
	try {
		const source = fs.readFileSync(filePath, "utf8").replace(/^#!.*/, "");
		nodeBuiltin("node:vm").compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"]);
		return true;
	} catch {
		return false;
	}
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
 * @returns {object} A vite plugin (`name`, `enforce`, `resolveId`, `load`).
 * @public
 * @example
 * // vitest.config.mjs
 * import { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
 * export default defineConfig({ plugins: [slothletInstanceImports()] });
 */
export function slothletInstanceImports() {
	return {
		name: "slothlet-instance-imports",
		enforce: "pre",
		/**
		 * Resolve a relative/`file:` import of a slothlet leaf with the leaf's instance query.
		 * @param {string} source - The specifier as written.
		 * @param {string|undefined} importer - The importing module's id.
		 * @param {object} [options] - Vite resolve options.
		 * @returns {Promise<object|null>} The resolution, or null to defer to other resolvers.
		 */
		async resolveId(source, importer, options) {
			if (typeof importer !== "string" || !importer.includes(MARKER) || !isFileSpecifier(source)) return null;
			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
			if (!resolved || resolved.external) return resolved;
			const id = propagateInstanceQuery(source, importer, resolved.id);
			return id === resolved.id ? resolved : { ...resolved, id };
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
				if (typeof id !== "string" || !id.includes(MARKER)) return null;
				const [base, query = ""] = splitQuery(id);
				const instanceID = new URLSearchParams(query).get("slothlet_instance");
				if (instanceID === null || isCommonJSFile(base)) return null;
				let ast;
				try {
					ast = this.parse(code);
				} catch {
					// Code this parser cannot read is left as it is; its imports go unrecorded.
					return null;
				}
				// Static imports and re-exports, and dynamic import() calls with a literal specifier anywhere in the module.
				const specifiers = new Set();
				const visit = (node) => {
					if (!node || typeof node !== "object") return;
					if (Array.isArray(node)) {
						for (const child of node) visit(child);
						return;
					}
					if (typeof node.type !== "string") return;
					const isImport = /^(?:ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration|ImportExpression)$/.test(node.type);
					const source = isImport ? node.source?.value : undefined;
					if (typeof source === "string" && isFileSpecifier(source)) specifiers.add(source);
					for (const key of Object.keys(node)) if (key !== "type") visit(node[key]);
				};
				visit(ast.body);
				const children = [];
				for (const specifier of specifiers) {
					const resolved = await this.resolve(specifier, id);
					if (resolved && !resolved.external && resolved.id.includes(MARKER)) children.push(resolved.id);
				}
				if (!children.length) return null;
				const registration = `globalThis[Symbol.for(${JSON.stringify(STATE.description)})]?.recordImports?.(${JSON.stringify(instanceID)}, ${JSON.stringify(id)}, ${JSON.stringify(children)});`;
				return { code: `${code}\n;${registration}\n`, map: null };
			}
		},
		/**
		 * Load a CommonJS helper carrying an instance query as its per-instance ES module wrapper.
		 * @param {string} id - The module id.
		 * @returns {object|null} The wrapper code, or null to defer to vite's own loading.
		 */
		load(id) {
			if (typeof id !== "string" || !id.includes(MARKER)) return null;
			const [base, query = ""] = splitQuery(id);
			const instanceID = new URLSearchParams(query).get("slothlet_instance");
			if (instanceID === null || !isCommonJSFile(base)) return null;
			return { code: commonJSWrapperSource(base, instanceID, null) };
		}
	};
}
