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
    mode?: "eager" | "lazy";
    /**
     * - Context propagation runtime.
     * - `"async"` — AsyncLocalStorage (Node.js built-in, recommended for production).
     * - `"live"` — Experimental live bindings.
     * Also accepted: `"asynclocalstorage"` / `"als"` / `"node"` as aliases for `"async"`.
     */
    runtime?: "async" | "live";
    /**
     * - Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root.
     */
    apiDepth?: number;
    /**
     * - Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`.
     */
    context?: object | null;
    /**
     * - Object whose properties are merged directly onto the root API and also available as `api.slothlet.reference`.
     */
    reference?: object | null;
    /**
     * - Controls how per-request scope data is merged. `"shallow"` merges top-level keys; `"deep"` recurses into nested objects.
     */
    scope?: {
        merge: "shallow" | "deep";
    };
    /**
     * - API build and mutation settings.
     */
    api?: {
        collision?: string | {
            initial: string;
            api: string;
        };
        mutations?: object;
    };
    /**
     * - Hook system configuration.
     * - `false` — disabled (default).
     * - `true` — enabled, all endpoints.
     * - `string` — enabled with a default glob pattern.
     * - `object` — full control: `{ enabled: boolean, pattern?: string, suppressErrors?: boolean }`.
     */
    hook?: boolean | string | object;
    /**
     * - Enable verbose internal logging. `true` enables all categories.
     * Pass an object with sub-keys `builder`, `api`, `index`, `modes`, `wrapper`, `ownership`, `context` to target specific subsystems.
     */
    debug?: boolean | object;
    /**
     * - Suppress all console output from slothlet (warnings, deprecations). Does not affect `debug`.
     */
    silent?: boolean;
    /**
     * - Enable the `api.slothlet.diag.*` introspection namespace. Intended for testing; do not enable in production.
     */
    diagnostics?: boolean;
    /**
     * - Enable internal tracking. Pass `true` or `{ materialization: true }` to track lazy-mode materialization progress.
     */
    tracking?: boolean | object;
    /**
     * - When `mode: "lazy"`, immediately begins materializing all paths in the background after init.
     */
    backgroundMaterialize?: boolean;
    /**
     * - Internationalization settings (dev-facing, process-global).
     * `{ language: string }` — selects the locale for framework messages (e.g. `"en-us"`, `"fr-fr"`, `"ja-jp"`).
     */
    i18n?: object;
    /**
     * - Environment variable snapshot configuration.
     * Pass `{ include: ["KEY"] }` to capture only the listed variable names in `api.slothlet.env`.
     * Omit (or pass `undefined`) to capture a full frozen snapshot of `process.env`.
     * Non-string entries in `include` are silently ignored; an all-non-string array falls back to the full snapshot.
     */
    env?: {
        include?: string[];
    };
    /**
     * - TypeScript support.
     * - `false` — disabled (default).
     * - `true` or `"fast"` — esbuild transpilation, no type checking.
     * - `"strict"` — tsc compilation with type checking and `.d.ts` generation.
     * See [TYPESCRIPT.md](docs/TYPESCRIPT.md) for the full configuration reference.
     */
    typescript?: boolean | "fast" | "strict" | object;
    /**
     * - Version routing discriminator for versioned API paths.
     * - **string** (e.g. `"version"`) — at dispatch time, reads that key from the calling module's version metadata to select a version tag.
     * - **function** — called as `(allVersions, caller) => versionTag | null`; return a registered version tag to force routing, or `null`/`undefined` to fall through to the automatic default.
     * - **omitted / `undefined`** — behaves identically to `"version"`.
     * Only relevant when modules are registered via `api.slothlet.api.add()` with a `versionConfig` argument.
     */
    versionDispatcher?: string | Function | null;
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
            inspect: () => any;
            run: Function;
            scope: Function;
            set: Function;
        };
        diag?: {
            caches?: {
                get?: () => any;
                getAllModuleIDs?: () => string[];
                has?: Function;
            };
            context?: object;
            describe?: Function;
            getAPI?: () => any;
            getOwnership?: () => any;
            hook?: object;
            inspect?: () => any;
            owner?: {
                get?: Function;
            };
            reference?: object;
            SlothletWarning?: () => SlothletWarning;
        };
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
            get: () => any;
            materialized: boolean;
            wait: () => Promise<void>;
        };
        metadata: {
            caller: () => any | null;
            get: Function;
            remove: Function;
            removeFor: Function;
            self: () => any | null;
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
        reference?: object;
        reload: Function;
        run: Function;
        scope: Function;
        shutdown: () => Promise<void>;
    };
};
import { SlothletWarning } from "@cldmv/slothlet/errors";
//# sourceMappingURL=slothlet.d.mts.map