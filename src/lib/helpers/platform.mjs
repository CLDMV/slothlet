/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/platform.mjs
 *	@Date: 2026-05-29 22:02:43 -07:00 (1780117363)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:17:59 -07:00 (1780546679)
 *	-----
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
 *
 * ## Browser-only branches & coverage (policy)
 * The browser arms here — and in the modules that import `isNode` (the `else`/`: null` shims, the
 * i18n browser paths, the live-mode null-ALS arm) — are UNREACHABLE under the Node coverage run:
 * `process.versions.node` is always truthy there, even in the `platform:"browser"` node-side suites.
 *
 * They are now genuinely covered+counted by a **vitest browser-mode** run (real headless Chromium,
 * Playwright provider — `.configs/vitest.browser.config.mjs`, `tests/browser/*.browser.test.mjs`).
 * Because that run uses the SAME `@vitest/coverage-v8` provider over vite-transformed source as the
 * node run, the two `coverage-final.json` maps align and merge cleanly
 * (`tools/coverage/merge-browser-coverage.mjs`, wired as `npm run coverage:all`). An earlier merge was
 * rejected, but that was of the raw-source Playwright *smoke* (`npm run test:browser`), whose importmap
 * serves raw `src/` — those maps don't align with node's. The vitest-browser run does, which is what
 * makes the merge correct. Only arms unreachable in BOTH hosts (e.g. an exotic non-Node host with no
 * `process`/`navigator`) keep a precise v8 ignore-next comment. The smoke remains as a raw-importmap
 * load check (the path a real consumer uses), not the coverage justification.
 */

// Detection runs once. In a browser/worker `process` is absent and this resolves false; the vitest
// browser run exercises that arm (the node run cannot — `process` is always present there).
const isNode = typeof process !== "undefined" && Boolean(process?.versions?.node);

/**
 * Resolved Node.js builtins (Node host) or browser shims / `null` (browser host).
 *
 * Each is initialized to `null` and reassigned to the real builtin inside the `isNode`
 * block below; in a browser the Node-only ones stay `null` (every call site is
 * `isNode`-guarded) and `util` becomes a minimal shim. Annotated `any` (not bare `null`,
 * which would make a TS consumer treat them as non-callable, nor the precise
 * `typeof import("node:*")` shape, which would force `@types/node` onto every consumer —
 * including browser ones — and break the no-extra-types export contract). `any` keeps them
 * usable from TS while the polymorphic real-module / shim / `null` behavior is documented here.
 * @private
 */
/** @type {any} */
let fs = null;
/** @type {any} */
let fsp = null;
/** @type {any} */
let path = null;
/** @type {any} */
let url = null;
/** @type {any} */
let util = null;
/** @type {any} */
let EventEmitter = null;
/** @type {any} */
let AsyncLocalStorage = null;
/** @type {any} */
let AsyncResource = null;
/** @type {any} */
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
	// Browser host: the `else` arm (util shim) runs without `process`; exercised by the vitest browser run.
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
	// Browser host: async dynamic JSON import, delegated to loadJsonBrowser (exercised by the vitest
	// browser run via loadJson()). Delegated rather than inlined as `import(...).then().catch()` so the
	// `import(...)` expression is the LAST token on its line: vitest's browser transform wraps dynamic
	// imports and shifts the columns of anything after them, which moves trailing `.then`/`.catch`
	// callbacks off the positions the node (SSR) transform maps them to — defeating the location-based
	// coverage merge. The await form keeps every coverable entry starting at/before the import.
	if (!isNode) {
		return loadJsonBrowser(ref);
	}
	try {
		return JSON.parse(fs.readFileSync(ref, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * Browser host helper for {@link loadJson}: dynamic JSON import.
 *
 * @description
 * `import(ref, { with: { type: "json" } })` — a JSON module always exposes the parsed value as
 * `default`, so that is returned (coalesced to `null` to uphold the `object | null` contract); a failed import resolves to `null` so the caller keeps its
 * bundled default. Kept separate from {@link loadJson} so the import expression ends its own line (see
 * the note in loadJson on vitest's dynamic-import wrapping and the coverage merge).
 *
 * @param {string} ref - Importmap specifier (e.g. "@cldmv/slothlet/i18n/language/es-mx.json").
 * @returns {Promise<object|null>} Parsed JSON, or null on a failed import.
 * @private
 */
async function loadJsonBrowser(ref) {
	try {
		const mod = await import(ref, { with: { type: "json" } });
		// A JSON module always default-exports its parsed value, so for a real locale (always an object)
		// `mod.default` is never nullish here; the `?? null` only upholds the documented `object | null`
		// return contract and is therefore unreachable, so its arm is honestly ignored (no contrived
		// null-JSON fixture needed). A failed import is handled by the catch below.
		/* v8 ignore next */
		return mod.default ?? null;
	} catch {
		return null;
	}
}

export { isNode, fs, fsp, path, url, util, EventEmitter, AsyncLocalStorage, AsyncResource, createRequire, loadJson };
