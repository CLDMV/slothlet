/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/platform.mjs
 *	@Date: 2026-05-29 22:02:43 -07:00 (1780117363)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Single source of truth for Node.js-vs-browser host differences.
 * @module @cldmv/slothlet/helpers/platform
 * @internal
 *
 * @description
 * Slothlet runs in two hosts: Node.js (full filesystem access) and browser /
 * Electron-renderer "browser mode" (no `node:*` builtins, manifest-based loading).
 * Rather than scatter `typeof process` checks and gated `await import("node:*")`
 * blocks across a dozen modules (#123), every host difference is decided ONCE here
 * and the rest of the codebase imports the resolved builtins (or browser shims)
 * plus `isNode` via plain static imports — no `node:*` specifier ever enters the
 * static-import graph a browser must parse.
 *
 * The builtins are pulled in through a single top-level-await `import()` block
 * guarded by `isNode`. In a browser the same exports resolve to `null` (for the
 * Node-only ones, whose every call site is `isNode`-guarded) or to a minimal shim
 * (`util`, which is consumed in both hosts for `inspect` / `types.isProxy`).
 *
 * Anything that genuinely cannot run outside Node and is never reachable from a
 * browser module graph (TypeScript compilation, type generation, manifest
 * generation) keeps its own direct `node:*` imports — routing those through here
 * would only drag build-time-only builtins (`crypto`, `os`) into the shared hub.
 */

// Detection runs once. The false-arm short-circuits (`process` absent, optional
// chaining bailing out) only fire in real browsers / workers / Electron renderers,
// which the Node-only vitest runner cannot exercise without stubbing the `process`
// global (which destabilizes vitest itself).
/* v8 ignore next */
const isNode = typeof process !== "undefined" && Boolean(process?.versions?.node);

/**
 * Resolved Node.js builtins (Node host) or browser shims / `null` (browser host).
 * @private
 */
let fs = null;
let fsp = null;
let path = null;
let url = null;
let util = null;
let EventEmitter = null;
let AsyncLocalStorage = null;
let AsyncResource = null;
let createRequire = null;

if (isNode) {
	const [fsMod, fspMod, pathMod, urlMod, utilMod, eventsMod, asyncHooksMod, moduleMod] = await Promise.all([
		import("node:fs"),
		import("node:fs/promises"),
		import("node:path"),
		import("node:url"),
		import("node:util"),
		import("node:events"),
		import("node:async_hooks"),
		import("node:module")
	]);
	fs = fsMod;
	fsp = fspMod;
	path = pathMod;
	url = urlMod;
	util = utilMod;
	({ EventEmitter } = eventsMod);
	({ AsyncLocalStorage, AsyncResource } = asyncHooksMod);
	({ createRequire } = moduleMod);
	/* v8 ignore start -- browser host: the false-arm (util shim) runs only without `process`, unreachable under the Node-only vitest runner */
} else {
	// `util` is the one builtin consumed in both hosts: `inspect` (with its custom
	// symbol) for value formatting and `types.isProxy` for proxy detection. Slothlet's
	// own wrappers are resolved via resolveWrapper(), so a browser-side `isProxy()`
	// that always returns false only loses detection of *arbitrary user* proxies —
	// a documented browser limitation, not a correctness bug for slothlet internals.
	util = {
		inspect: Object.assign((value) => value, { custom: Symbol.for("nodejs.util.inspect.custom") }),
		types: { isProxy: () => false }
	};
	/* v8 ignore stop */
}

/**
 * Load and parse JSON, branching on host — this is the single place that knows how each
 * environment reads JSON.
 *
 * @description
 * - **Node**: synchronous `fs.readFileSync` + parse. Returns the parsed object directly (or
 *   `null` on a read/parse failure). `ref` is a filesystem path or `file:` URL.
 * - **Browser**: asynchronous dynamic `import(ref, { with: { type: "json" } })`. Returns a
 *   `Promise<object|null>` — a miss resolves to `null` (callers keep their bundled default;
 *   a failed import also surfaces a console error, which is harmless). `ref` is a module
 *   specifier resolvable via the page's importmap (e.g. `@cldmv/slothlet/i18n/language/es-mx.json`).
 *
 * The return type is therefore polymorphic by host: `object|null` in Node, `Promise<object|null>`
 * in a browser. Callers that already branch on `isNode` consume the matching form directly;
 * `await loadJson(...)` is safe in both (awaiting a non-promise is a no-op).
 *
 * @param {string} ref - Filesystem path / `file:` URL (Node) or importmap specifier (browser).
 * @returns {object|null|Promise<object|null>} Parsed JSON (Node, sync) or a promise of it (browser).
 * @internal
 *
 * @example
 * // Node (sync):
 * const pkg = loadJson(new URL("../../package.json", import.meta.url));
 * // Browser (async):
 * const es = await loadJson("@cldmv/slothlet/i18n/language/es-mx.json");
 */
function loadJson(ref) {
	/* v8 ignore start -- browser host: async dynamic JSON import; unreachable under the Node-only runner */
	if (!isNode) {
		return import(ref, { with: { type: "json" } })
			.then((mod) => mod.default ?? null)
			.catch(() => null);
	}
	/* v8 ignore stop */
	try {
		return JSON.parse(fs.readFileSync(ref, "utf-8"));
	} catch {
		return null;
	}
}

export { isNode, fs, fsp, path, url, util, EventEmitter, AsyncLocalStorage, AsyncResource, createRequire, loadJson };
