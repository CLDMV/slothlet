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
/**
 * Run `fn` on a later macrotask, in any host.
 *
 * @description
 * `setImmediate` is Node-only: a browser has none, and neither does an Electron context-isolated
 * renderer, so calling it directly from browser-reachable code throws (#578). This picks the best
 * macrotask primitive the host offers, in order:
 * - `setImmediate` (Node);
 * - a `MessageChannel` post (browsers, workers), which runs ahead of clamped timers;
 * - `setTimeout(fn, 0)` as the last resort.
 *
 * The schedulers are the host's as they were when slothlet loaded, and `fn` is pinned to its caller as the
 * context-carrying versions installed by `helpers/scheduler-context` pin a callback. All three run `fn` only after the
 * current call stack and every queued microtask have drained, which is the guarantee callers rely on.
 *
 * @param {Function} fn - Callback to run.
 * @param {{setImmediate: Function|undefined, MessageChannel: Function|undefined, setTimeout: Function}} [hosts] - The
 *   schedulers to pick from: the host's own unless a test hands in others.
 * @returns {void}
 * @internal
 *
 * @example
 * scheduleMacrotask(() => patchAfterAssignment());
 */
export function scheduleMacrotask(fn: Function, hosts?: {
    setImmediate: Function | undefined;
    MessageChannel: Function | undefined;
    setTimeout: Function;
}): void;
/**
 * `value instanceof ctor` as the language answers it, without any `Symbol.hasInstance` a module gave the class: a
 * module can give a global class (`Promise`, `Error`) one of its own, which an `instanceof` in slothlet's code would run
 * with the value slothlet is checking.
 * @param {*} value - The value.
 * @param {Function|null|undefined} ctor - The class; anything not a function answers false.
 * @returns {boolean} Whether `ctor.prototype` is on the value's prototype chain.
 * @public
 * @example
 * inheritsFrom(Promise.resolve(), Promise); // true
 */
export function inheritsFrom(value: any, ctor: Function | null | undefined): boolean;
//# sourceMappingURL=platform.d.mts.map