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
 * ## Browser-only branches & `v8 ignore` (policy)
 * The browser arms here — and in the modules that import `isNode` (the `else`/`: null` shims, the
 * i18n browser paths, the live-mode `tryGetContext` null-ALS arm) — are marked `/ * v8 ignore * /`
 * deliberately. They are UNREACHABLE under the Node coverage run: `process.versions.node` is always
 * truthy there, even in the `platform:"browser"` node-side suites, so the false arm never executes.
 * Forcing it would require stubbing/deleting the `process` global, which destabilizes vitest.
 *
 * They are NOT untested: every one executes in a real headless Chromium via the Playwright smoke
 * (`npm run test:browser`), which composes browser mode and exercises self / context / hooks /
 * permissions / metadata / i18n / lifecycle events / api.add. A coverage *merge* of the two runs was
 * evaluated and rejected — vitest instruments vite-transformed source while the browser runs raw
 * source, so the istanbul statement maps don't align and merging corrupts the report (turns real
 * Node-covered lines into false uncovered). So the contract is: `v8 ignore` for the Node report,
 * the real-Chromium smoke for correctness.
 */
export const isNode: boolean;
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
export let fs: any;
/** @type {any} */
export let fsp: any;
/** @type {any} */
export let path: any;
/** @type {any} */
export let url: any;
/** @type {any} */
export let util: any;
/** @type {any} */
export let EventEmitter: any;
/** @type {any} */
export let AsyncLocalStorage: any;
/** @type {any} */
export let AsyncResource: any;
/** @type {any} */
export let createRequire: any;
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
export function loadJson(ref: string): object | null | Promise<object | null>;
//# sourceMappingURL=platform.d.mts.map