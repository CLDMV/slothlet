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
 * Configuration options passed to {@link module :@cldmv/slothlet slothlet()}.
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
     * - TypeScript support.
     * - `false` — disabled (default).
     * - `true` or `"fast"` — esbuild transpilation, no type checking.
     * - `"strict"` — tsc compilation with type checking and `.d.ts` generation.
     * See [TYPESCRIPT.md](docs/TYPESCRIPT.md) for the full configuration reference.
     */
    typescript?: boolean | "fast" | "strict" | object;
};
/**
 * Bound API object returned by {@link module :@cldmv/slothlet slothlet()}.
 * The root contains all loaded module exports plus the reserved `slothlet` namespace.
 */
export type SlothletAPI = {
    /**
     * - Built-in control namespace.
     */
    slothlet: {
        shutdown: Function;
        api: object;
        hook: object;
        context: object;
        lifecycle: object;
        metadata: object;
        ownership: object;
        diag?: object;
        reference?: object;
    };
};
//# sourceMappingURL=slothlet.d.mts.map