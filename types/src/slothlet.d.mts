/**
 * Create a new Slothlet instance and load an API from a directory.
 * This is the sole public entry point for slothlet. Each call produces an independent
 * API instance with its own component graph, context store, and lifecycle.
 * @alias module:@cldmv/slothlet
 * @async
 * @param {SlothletOptions} config - Configuration options
 * @returns {Promise<SlothletAPI>} Fully loaded, proxy-based API object
 * @public
 * @example
 * // Minimal usage
 * const api = await slothlet({ dir: "./api" });
 * const result = await api.math.add(2, 3);
 * await api.slothlet.shutdown();
 *
 * @example
 * // Lazy mode with background materialization
 * const api = await slothlet({
 *   dir: "./api",
 *   mode: "lazy",
 *   backgroundMaterialize: true
 * });
 *
 * @example
 * // With hooks
 * const api = await slothlet({ dir: "./api", hook: true });
 * api.slothlet.hook.on("before", "**", (endpoint, args) => { /* ... *\/ });
 *
 * @example
 * // Hot-reload a module at runtime
 * await api.slothlet.api.reload("./api/math.mjs");
 *
 * @example
 * // Strict collision control
 * const api = await slothlet({
 *   dir: "./api",
 *   api: { collision: { initial: "merge", api: "error" } }
 * });
 */
export function slothlet(config: SlothletOptions): Promise<SlothletAPI>;
export default slothlet;
/**
 * Configuration options passed to `slothlet()`.
 */
export type SlothletOptions = {
    /**
     * - Directory to scan for API modules. Relative paths are resolved from the calling file.
     */
    dir: string;
    /**
     * - Loading strategy.
     * - `"eager"` — all modules are loaded immediately at startup (default).
     * - `"lazy"` — modules are loaded on first access via a Proxy.
     * Also accepted: `"immediate"` / `"preload"` (eager aliases); `"deferred"` / `"proxy"` (lazy aliases).
     */
    mode?: "eager" | "lazy" | undefined;
    /**
     * - Context propagation runtime.
     * - `"async"` — AsyncLocalStorage (Node.js built-in, recommended for production).
     * - `"live"` — Experimental live bindings.
     * Also accepted: `"asynclocalstorage"` / `"als"` / `"node"` as aliases for `"async"`.
     */
    runtime?: "async" | "live" | undefined;
    /**
     * - Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root.
     */
    apiDepth?: number | undefined;
    /**
     * - Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`.
     */
    context?: object | null | undefined;
    /**
     * - Object whose properties are merged directly onto the root API and also available as `api.slothlet.reference`.
     */
    reference?: object | null | undefined;
    /**
     * - Controls how per-request scope data is merged. `"shallow"` merges top-level keys; `"deep"` recurses into nested objects.
     */
    scope?: {
        merge: "shallow" | "deep";
    } | undefined;
    /**
     * - API build and mutation settings.
     */
    api?: {
        /**
         * - Collision strategy when two modules export the same path.
         * Modes: `"merge"` (default), `"merge-replace"`, `"replace"`, `"skip"`, `"warn"`, `"error"`.
         * Pass an object to use different strategies for the initial build vs. runtime `api.slothlet.api.add()` calls.
         */
        collision?: string | {
            initial: string;
            api: string;
        } | undefined;
        /**
         * - Enable or disable runtime mutation methods on `api.slothlet.api`.
         * Object with boolean keys `add`, `remove`, `reload` (all default `true`).
         */
        mutations?: object | undefined;
    } | undefined;
    /**
     * - Hook system configuration.
     * - `false` — disabled (default).
     * - `true` — enabled, all endpoints.
     * - `string` — enabled with a default glob pattern.
     * - `object` — full control: `{ enabled: boolean, pattern?: string, suppressErrors?: boolean }`.
     */
    hook?: string | boolean | object | undefined;
    /**
     * - Enable verbose internal logging. `true` enables all categories.
     * Pass an object with sub-keys `builder`, `api`, `index`, `modes`, `wrapper`, `ownership`, `context` to target specific subsystems.
     */
    debug?: boolean | object | undefined;
    /**
     * - Suppress all console output from slothlet (warnings, deprecations). Does not affect `debug`.
     */
    silent?: boolean | undefined;
    /**
     * - Enable the `api.slothlet.diag.*` introspection namespace. Intended for testing; do not enable in production.
     */
    diagnostics?: boolean | undefined;
    /**
     * - Enable internal tracking. Pass `true` or `{ materialization: true }` to track lazy-mode materialization progress.
     */
    tracking?: boolean | object | undefined;
    /**
     * - When `mode: "lazy"`, immediately begins materializing all paths in the background after init.
     */
    backgroundMaterialize?: boolean | undefined;
    /**
     * - Internationalization settings (dev-facing, process-global).
     * `{ language: string }` — selects the locale for framework messages (e.g. `"en-us"`, `"fr-fr"`, `"ja-jp"`).
     */
    i18n?: object | undefined;
    /**
     * - Environment variable snapshot configuration.
     * Pass `{ include: ["KEY"] }` to capture only the listed variable names in `api.slothlet.env`.
     * Omit (or pass `undefined`) to capture a full frozen snapshot of `process.env`.
     * Non-string entries in `include` are silently ignored; an all-non-string array falls back to the full snapshot.
     */
    env?: {
        /**
         * - Allowlist of environment variable names to capture. Only string entries are used.
         */
        include?: string[] | undefined;
    } | undefined;
    /**
     * - TypeScript support.
     * - `false` — disabled (default).
     * - `true` or `"fast"` — esbuild transpilation, no type checking.
     * - `"strict"` — tsc compilation with type checking and `.d.ts` generation.
     * See [TYPESCRIPT.md](docs/TYPESCRIPT.md) for the full configuration reference.
     */
    typescript?: boolean | object | "fast" | "strict" | undefined;
    /**
     * - Version routing discriminator for versioned API paths.
     * - **string** (e.g. `"version"`) — at dispatch time, reads that key from the calling module's version metadata to select a version tag.
     * - **function** — called as `(allVersions, caller) => versionTag | null`; return a registered version tag to force routing, or `null`/`undefined` to fall through to the automatic default.
     * - **omitted / `undefined`** — behaves identically to `"version"`.
     * Only relevant when modules are registered via `api.slothlet.api.add()` with a `versionConfig` argument.
     */
    versionDispatcher?: string | Function | null | undefined;
};
/**
 * Bound API object returned by `slothlet()`.
 * The root contains all loaded module exports plus the reserved `slothlet` namespace.
 */
export type SlothletAPI = {
    /**
     * - Like `shutdown()` but additionally invokes registered destroy hooks before teardown. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.destroy();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.destroy();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.destroy();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.destroy();%%
     */
    destroy: () => void;
    /**
     * - Convenience alias for `slothlet.shutdown()`. Shuts down the instance and invokes any user-provided shutdown hook first. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.shutdown();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.shutdown();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.shutdown();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.shutdown();%%
     */
    shutdown: () => void;
    /**
     * - Built-in control namespace. All framework internals live here to avoid collisions with loaded modules.
     */
    slothlet: {
        env: Readonly<Record<string, string | undefined>>;
        api: {
            add: Function;
            reload: Function;
            remove: Function;
        };
        context: {
            get: Function;
            inspect: () => Object;
            run: Function;
            scope: Function;
            set: Function;
        };
        diag?: {
            /**
             * - Cache diagnostics sub-namespace.
             */
            caches?: {
                /**
                 * - Get full cache diagnostic data (`{ totalCaches, caches[] }`). Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const cacheData = api.slothlet.diag.caches.get();|// { totalCaches: 2, caches: [...] }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const cacheData = api.slothlet.diag.caches.get();|  // { totalCaches: 2, caches: [...] }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const cacheData = api.slothlet.diag.caches.get();|  // { totalCaches: 2, caches: [...] }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const cacheData = api.slothlet.diag.caches.get();|// { totalCaches: 2, caches: [...] }%%
                 */
                get?: (() => Object) | undefined;
                /**
                 * - Return all moduleIDs currently in cache. Only available when `diagnostics: true`. %%sig: (): string[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const ids = api.slothlet.diag.caches.getAllModuleIDs();|// ['utils/math.mjs', 'utils/strings.mjs']%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const ids = api.slothlet.diag.caches.getAllModuleIDs();|  // ['utils/math.mjs', 'utils/strings.mjs']|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const ids = api.slothlet.diag.caches.getAllModuleIDs();|  // ['utils/math.mjs', 'utils/strings.mjs']|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const ids = api.slothlet.diag.caches.getAllModuleIDs();|// ['utils/math.mjs', 'utils/strings.mjs']%%
                 */
                getAllModuleIDs?: (() => string[]) | undefined;
                /**
                 * - Check whether a cache entry exists for a given moduleID. Only available when `diagnostics: true`. %%sig: (moduleID: string): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false%%
                 */
                has?: Function | undefined;
            } | undefined;
            /**
             * - The `context` config value as passed to `slothlet()`.
             */
            context?: object | undefined;
            /**
             * - Describe API structure. Pass `true` to return the full API object; omit for top-level keys only. Only available when `diagnostics: true`. %%sig: ([showAll]: boolean): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const keys = api.slothlet.diag.describe();|const full = api.slothlet.diag.describe(true);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const keys = api.slothlet.diag.describe();|  const full = api.slothlet.diag.describe(true);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const keys = api.slothlet.diag.describe();|  const full = api.slothlet.diag.describe(true);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const keys = api.slothlet.diag.describe();|const full = api.slothlet.diag.describe(true);%%
             */
            describe?: Function | undefined;
            /**
             * - Return the live bound API proxy object. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy%%
             */
            getAPI?: (() => Object) | undefined;
            /**
             * - Return ownership diagnostics for all registered API paths. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const ownership = api.slothlet.diag.getOwnership();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const ownership = api.slothlet.diag.getOwnership();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const ownership = api.slothlet.diag.getOwnership();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const ownership = api.slothlet.diag.getOwnership();%%
             */
            getOwnership?: (() => Object) | undefined;
            /**
             * - Hook system diagnostics sub-namespace (present only when hooks are enabled).
             */
            hook?: object | undefined;
            /**
             * - Return a full diagnostic snapshot of current instance state. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const snapshot = api.slothlet.diag.inspect();|console.log(snapshot.modules, snapshot.hooks);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const snapshot = api.slothlet.diag.inspect();|  console.log(snapshot.modules, snapshot.hooks);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const snapshot = api.slothlet.diag.inspect();|  console.log(snapshot.modules, snapshot.hooks);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const snapshot = api.slothlet.diag.inspect();|console.log(snapshot.modules, snapshot.hooks);%%
             */
            inspect?: (() => Object) | undefined;
            /**
             * - Ownership sub-namespace for diagnostics.
             */
            owner?: {
                /**
                 * - Get the owning moduleIDs for a specific API path. Only available when `diagnostics: true`. %%sig: (apiPath: string): string[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const owners = api.slothlet.diag.owner.get('math.add');|// ['utils/math.mjs']%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const owners = api.slothlet.diag.owner.get('math.add');|  // ['utils/math.mjs']|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const owners = api.slothlet.diag.owner.get('math.add');|  // ['utils/math.mjs']|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const owners = api.slothlet.diag.owner.get('math.add');|// ['utils/math.mjs']%%
                 */
                get?: Function | undefined;
            } | undefined;
            /**
             * - The `reference` config value as passed to `slothlet()`.
             */
            reference?: object | undefined;
            /**
             * - The `SlothletWarning` class — access `.captured` for warnings emitted during tests. Only available when `diagnostics: true`. %%sig: (): SlothletWarning%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const SlothletWarning = api.slothlet.diag.SlothletWarning;|console.log(SlothletWarning.captured); // array of captured warnings%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const SlothletWarning = api.slothlet.diag.SlothletWarning;|  console.log(SlothletWarning.captured); // array of captured warnings|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const SlothletWarning = api.slothlet.diag.SlothletWarning;|  console.log(SlothletWarning.captured); // array of captured warnings|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const SlothletWarning = api.slothlet.diag.SlothletWarning;|console.log(SlothletWarning.captured); // array of captured warnings%%
             */
            SlothletWarning?: (() => SlothletWarning) | undefined;
        } | undefined;
        hook: {
            clear: Function;
            disable: Function;
            enable: Function;
            list: Function;
            off: Function;
            on: Function;
            remove: Function;
        };
        lifecycle: {
            off: Function;
            on: Function;
        };
        materialize: {
            get: () => Object;
            materialized: boolean;
            wait: () => Promise<void>;
        };
        metadata: {
            caller: () => Object | null;
            get: Function;
            remove: Function;
            removeFor: Function;
            self: () => Object | null;
            set: Function;
            setFor: Function;
            setGlobal: Function;
        };
        owner: {
            get: Function;
        };
        ownership: {
            get: Function;
            unregister: Function;
        };
        versioning: {
            list: Function;
            setDefault: Function;
            unregister: Function;
            getVersionMetadata: Function;
            setVersionMetadata: Function;
        };
        reference?: object | undefined;
        reload: Function;
        run: Function;
        scope: Function;
        shutdown: () => Promise<void>;
    };
};
import { SlothletWarning } from "@cldmv/slothlet/errors";
//# sourceMappingURL=slothlet.d.mts.map