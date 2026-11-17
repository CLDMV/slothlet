/**
 * Create a new Slothlet instance and load an API from a directory.
 * This is the sole public entry point for slothlet. Each call produces an independent
 * API instance with its own component graph, context store, and lifecycle.
 * @alias module:@cldmv/slothlet
 * @async
 * @template {object} [T=import("./lib/runtime/runtime.mjs").SlothletSelf] - The loaded api's own shape.
 *   Defaults to `SlothletSelf`, which a `slothlet typegen` declaration extends with the project's api;
 *   pass another interface (`slothlet<OtherApi>(...)`) when a program loads more than one api.
 * @param {SlothletOptions} config - Configuration options
 * @returns {Promise<SlothletAPI & T>} Fully loaded, proxy-based API object
 * @public
 * @example
 * // Minimal usage
 * const api = await slothlet({ base: "./api" });
 * const result = await api.math.add(2, 3);
 * await api.slothlet.shutdown();
 *
 * @example
 * // Lazy mode with background materialization
 * const api = await slothlet({
 *   base: "./api",
 *   mode: "lazy",
 *   loader.materialize: true
 * });
 *
 * @example
 * // With hooks
 * const api = await slothlet({ base: "./api", hook: true });
 * api.slothlet.hook.on("before", "**", (endpoint, args) => { /* ... *\/ });
 *
 * @example
 * // Hot-reload a module at runtime
 * await api.slothlet.api.reload("./api/math.mjs");
 *
 * @example
 * // Strict collision control
 * const api = await slothlet({
 *   base: "./api",
 *   api: { collision: { initial: "merge", api: "error" } }
 * });
 */
export function slothlet<T extends object = import("./lib/runtime/runtime.mjs").SlothletSelf>(config: SlothletOptions): Promise<SlothletAPI & T>;
export namespace slothlet {
    let defaults: Readonly<{
        routines: ReadonlyArray<{
            name: string;
            mode: string;
        }>;
        reserved: ReadonlySet<string>;
    }>;
}
export default slothlet;
/**
 * Configuration options passed to `slothlet()`.
 */
export type SlothletOptions = {
    /**
     * - Directory (node mode) or file:// URL / base URL (browser mode) to load API modules from.
     * Required in both modes. Plain filesystem paths are automatically converted to `file://` URLs by the default browser-mode resolver.
     */
    base?: string | undefined;
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
     * Also accepted (case-insensitive): `"asynclocal"` / `"asynclocalstorage"` as aliases for `"async"`; `"livebindings"` / `"experimental"` as aliases for `"live"`.
     * Any other value silently falls back to `"async"`.
     */
    runtime?: "async" | "live" | undefined;
    /**
     * - How often a helper file (a file an api file imports that is no api file itself) is loaded.
     * - `"instance"` — once per instance: every api file importing the helper shares one copy, and so its module state.
     * - `"module"` — once per importing api file: each api file gets its own copy of every helper it imports, so helper state is not shared between api files, and the permission system can tell which api file a helper's code runs for. Node and the vite plugin only; a browser build keeps one copy.
     */
    helpers?: "module" | "instance" | undefined;
    /**
     * - Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root.
     */
    depth?: number | undefined;
    /**
     * - Glob or array of globs hiding files and folders from the API, matched against each entry's
     * path relative to `base` (folder-style `a/b` or dotted `a.b`; `*` one segment, `**` any depth, `?` one char, `{a,b}` alternation,
     * `!` re-includes, a trailing `/` names folders only, a name's leading `.` is part of the name). Files match on their
     * extension-stripped path. The globs sit over the built-in rule that hides `.`/`__`-prefixed names: they apply in order, the
     * last one that matches an entry decides, and an entry no glob matches falls to the built-in rule, so `"!**\/__*"` brings back
     * `__`-prefixed files and folders and `["!**\/.*\/", "!**\/__*\/"]` the folders only. Framework-reserved names are still refused.
     * Also accepted per-call by `api.slothlet.api.add(path, dir, { hidden })`, where globs are relative to the added folder.
     */
    hidden?: string | string[] | undefined;
    /**
     * - Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`.
     */
    context?: object | null | undefined;
    /**
     * - Object whose properties are merged directly onto the root API and, with `diagnostics: true`, readable as `api.slothlet.diag.reference`.
     */
    reference?: object | null | undefined;
    /**
     * - Defaults for `api.slothlet.context.scope()` runs.
     * `merge`: `"shallow"` merges top-level keys; `"deep"` recurses into nested objects (any other value throws `INVALID_CONFIG`).
     * `isolation`: `"partial"` (default) lets a scope's `self` writes reach the shared api; `"full"` gives the scope a copy-on-write `self`. A per-call `isolation` option overrides it; any other value throws `SCOPE_ISOLATION_MODE_INVALID`.
     */
    scope?: {
        merge?: "shallow" | "deep";
        isolation?: "partial" | "full";
    } | undefined;
    /**
     * - Init metadata. Each key is set as global metadata (inherited by every later `api.slothlet.api.add()`) and registered as user metadata for the base module. See [METADATA.md](docs/METADATA.md#init-metadata).
     */
    metadata?: object | null | undefined;
    /**
     * - Options for turning file and folder names into api property names, the same options `sanitizePropertyName()` takes:
     * `first` (default `true`), `preserve` (`{ upper?, lower? }`, each default `false`) and `rules` (`{ leave?, nocase?, upper?, lower? }`, each a `string[]` of exact names, globs or `**boundary**` patterns).
     * Applies to every file and folder name the loader derives and to `api.slothlet.sanitize()`. See [SANITIZATION.md](docs/SANITIZATION.md).
     */
    sanitize?: object | undefined;
    /**
     * - API build and mutation settings.
     */
    api?: {
        /**
         * - Collision handling. A bare
         * string is the shorthand for `{ mode }`.
         */
        collision?: string | {
            mode?: (string | {
                initial: string;
                api: string;
            });
            override?: boolean;
        } | undefined;
    } | undefined;
    /**
     * - Must be `true` before `api.slothlet.api.add()` honors a per-call `collisionMode` / `mutateExisting` / `recordHistory`.
     */
    override?: boolean | undefined;
    /**
     * - Enable or disable runtime mutation surfaces.
     * Object with boolean keys: `add`, `remove`, `reload` (`api.slothlet.api.*`), `permissions` (`api.slothlet.permissions.*` rule changes) and `events` (`api.slothlet.event.rules.*`), all default `true`.
     */
    mutations?: object | undefined;
    /**
     * - Hook system configuration.
     * - `false` — disabled (default).
     * - `true` — enabled, all endpoints.
     * - `string` — enabled with a default glob pattern.
     * - `object` — full control: `{ enabled: boolean, pattern?: string, errors?: "suppress"|false, pin?: boolean }` (`pin` defaults to `true`; `errors: true` means `"suppress"`).
     */
    hook?: string | boolean | object | undefined;
    /**
     * - Permission system configuration. Omit it and the system is off entirely. A bare `"on"`, `"off"` or `"disabled"` means `{ mode }`, `true` and `false` mean `"on"` and `"off"`; any other string or non-object value throws `INVALID_CONFIG`. See [PERMISSIONS.md](docs/PERMISSIONS.md#configuration).
     */
    permissions?: boolean | object | "on" | "off" | "disabled" | undefined;
    /**
     * - Fallback when no rule matches.
     */
    policy?: "deny" | "allow" | undefined;
    /**
     * - Audit level; `true`/`false` normalize to `"default"`.
     */
    audit?: boolean | "default" | "verbose" | undefined;
    /**
     * - Owner grant (#509): a caller leaf may access any target leaf currently owned
     * by the same module (the initial load's base module, or an `api.add()`'s `moduleID`) — across that module's own directories —
     * wherever `policy` would otherwise deny. Matched by owner, not path, so another module mounted into the same namespace
     * gets nothing; an explicit deny rule still wins. See [PERMISSIONS.md](docs/PERMISSIONS.md#owner-grant).
     */
    owner?: boolean | undefined;
    /**
     * - How the caller of a call or read is identified.
     */
    caller?: {
        /**
         * - Let a call or read with no resolvable caller through instead of denying it.
         */
        anonymous?: boolean | undefined;
        /**
         * - How the definer of code a module hands out is known
         * (#726): `"precise"` wraps a returned value that is itself code to record its definer, where the stack cannot tell it;
         * `"fast"` wraps nothing, keeping `===` for returned functions, and tells every definer from the stack, refusing where
         * it cannot. See [PERMISSIONS.md](docs/PERMISSIONS.md#code-a-module-hands-out-runs-as-its-definer).
         */
        attribution?: "fast" | "precise" | undefined;
        /**
         * - A function read out of the api keeps its reader's identity.
         */
        capture?: boolean | undefined;
        /**
         * - Code a caller hands to a leaf runs as that caller, under the
         * leaf it is running inside as its ceiling (#597); `"chain"` keeps every leaf the code was handed through as its ceiling
         * instead. See [PERMISSIONS.md](docs/PERMISSIONS.md#code-a-caller-hands-to-a-leaf-runs-as-the-caller).
         */
        ceiling?: "leaf" | "chain" | undefined;
        /**
         * - A module's function reached by a route slothlet does not see — a
         * callback, a shared object, a global, a replaced built-in — runs as that module inside another module's call, with
         * the call as its ceiling (#597). `false` turns this off: such a function then runs with the permissions of whichever
         * call runs it, and what a module returns is searched for code when it is handed out instead, so code nested in
         * returned data keeps its definer.
         */
        provenance?: boolean | undefined;
    } | undefined;
    /**
     * - What is gated besides calls.
     */
    gating?: {
        /**
         * - Whether a typed array or `Buffer` one module hands
         * another is checked for members of its own under string keys (`bytes.item = …`), which means listing its keys:
         * `false` never lists, `true` always does, a whole number lists arrays of up to that many kilobytes. One found holding
         * a member is handed over as a view.
         */
        buffers?: number | boolean | undefined;
        /**
         * - Gate terminal data-value reads the same way calls are gated.
         */
        read?: boolean | undefined;
    } | undefined;
    /**
     * - Module privacy (`{ host?: "deny"|"allow", scope?: "module"|"folder" }`): whether the host reads `_`/`__` members, and whether a member is private to its owning module ID (default) or to the folder that exports it.
     */
    private?: object | undefined;
    /**
     * - Initial `{ caller, target, effect, condition?, requires? }` rules.
     */
    rules?: object[] | undefined;
    /**
     * - Event-rule section (`{ policy?: "deny"|"notify"|"allow", rules?: Array<object> }`).
     */
    events?: object | undefined;
    /**
     * - Enable verbose internal logging. `true` enables all categories.
     * Pass an object with sub-keys `builder`, `api`, `index`, `modes`, `wrapper`, `ownership`, `context`, `initialization`, `materialize`, `versioning`, `permissions` to target specific subsystems.
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
     * - Construction-time lifecycle subscribers, registered on the lifecycle emitter BEFORE the api builds so events emitted during cold-start `buildAPI` (init-time `impl:warning` / `impl:created` / …) are observable. Maps an event name to a handler `function(data, token)` or an array of them; any event name is accepted. Because they are ordinary subscribers, they also receive runtime events afterward — equivalent to calling `api.slothlet.lifecycle.on(event, fn)` for each, but early enough to catch initialization diagnostics. Because they come from the config, `api.slothlet.restart()` subscribes them again on the new instance, so they also receive the new instance's `init` and `restarted` events (runtime `lifecycle.on` subscribers are dropped with the old instance). Example: `{ "impl:warning": (d) => log(d), "impl:error": [onError, audit] }`.
     */
    lifecycle?: {
        [x: string]: Function | Function[];
    } | undefined;
    /**
     * - Stackable lifecycle routines (#341).
     */
    routines?: {
        /**
         * - Stackable lifecycle routines (#341). Every mounted module exporting a function matching a configured routine name is composed into one callable at its exact composed api path, plus a root cascade (`self.<name>()`, i.e. `api.<name>()`) that runs every matching contribution anywhere. Entries: `"name"` (mode `"manual"`), `"name:mode"`, or `{ name, mode?, recursive?, order?, cascade? }` (`recursive`/`order`/`cascade` only settable via the object form). `name` is mount-relative by default (a bare name matches only a mount's own top level; a dotted name matches a fixed relative sub-path, or with `recursive: true` any depth within the mount); a `^`-prefixed name is root-anchored, matched via glob (`*`, `**`, `{}`, `!`) against the full api path, crossing mount boundaries. `order` (`"mount"` | `"depth"`, mode-defaulted) controls the root cascade's grouping order. `cascade` (default `true`) controls whether the root `api.<name>()` run-all cascade is created at all — set `cascade: false` (#400) for a per-entity lifecycle routine, where the host must invoke exactly one co-owner by key via `api.<path>.<name>.for(moduleID)(...)` rather than a run-all; every stacked path also exposes `api.<path>.<name>.contributors` (the moduleIDs present there). `.for(key)` runs that one contributor in its own extent/identity with the args passed straight through, and bypasses the `routines.stack` owner-filter so a specific co-owner runs even if it lost the shared-path collision. Providing `routines.entries` REPLACES the built-in defaults (`slothlet.defaults.routines`: `initialize` → `startup`, `shutdown` → `shutdown`) — spread `slothlet.defaults.routines` to extend them instead, or pass `[]` to disable every routine. Every configured routine is always wrapped and directly callable regardless of `routines.auto`. Whether two or more contributors colliding at the identical api path all run is governed by `routines.stack` (#365), independent of the collision mode — by default every contributor at that path runs, in mount order; `routines.stack: false` runs only the single contribution that actually owns that path, matching ordinary collision behavior. A throwing contributor doesn't stop the chain — every contributor runs (best-effort), and one aggregate `ROUTINE_FAILED` error is thrown afterward if any failed. See [LIFECYCLE.md](docs/LIFECYCLE.md#routines).
         */
        entries?: (string | {
            name: string;
            mode?: ("manual" | "startup" | "shutdown" | "destroy");
            recursive?: boolean;
            order?: ("mount" | "depth");
            cascade?: boolean;
        })[] | undefined;
        /**
         * - When `true` (the default), every `mode: "startup"` routine's cascade runs at the end of compose, and every `mode: "shutdown"`/`"destroy"` routine's cascade runs on the corresponding dispose call. `false` leaves every routine to explicit calls. See [LIFECYCLE.md](docs/LIFECYCLE.md#routines).
         */
        auto?: boolean | undefined;
        /**
         * - Whether two or more modules' contributions colliding at the exact same composed api path all run (the default), or only the single contribution that actually owns that path (per the collision mode) runs (#365). Deliberately independent of the collision mode — with `false`, a module that loses a collision, under any mode, does not run via the routine system. The root cascade runs every matching contribution across distinct api paths regardless of this flag; where two or more contributions land on the identical api path, the cascade applies the same filtering a direct call at that path would. See [LIFECYCLE.md](docs/LIFECYCLE.md#routines).
         */
        stack?: boolean | undefined;
    } | undefined;
    /**
     * - Enable internal tracking. Pass `true` or `{ materialization: true }` to track lazy-mode materialization progress.
     */
    tracking?: boolean | object | undefined;
    /**
     * - Host only: the functions the instance reads the time and starts its deferred work with, instead of the ones slothlet loaded with. Read once when the instance is created and never part of the config the instance reports. See [CONFIGURATION.md](docs/CONFIGURATION.md#clock).
     */
    clock?: {
        /**
         * - The time in milliseconds: `ttl` of principals, reload and run IDs, and every recorded timestamp.
         */
        now?: (() => number) | undefined;
        /**
         * - Schedules the instance's deferred work as `setTimeout` does (called with a delay of `0`); a host that fakes timers moves it with its own clock.
         */
        set?: Function | undefined;
        /**
         * - Cancels a timer `clock.set` made, as `clearTimeout` does.
         */
        clear?: Function | undefined;
    } | undefined;
    /**
     * - Internationalization settings (dev-facing, process-global).
     * `{ language: string }` — selects the locale for framework messages (e.g. `"en-us"`, `"fr-fr"`, `"ja-jp"`).
     */
    i18n?: object | undefined;
    /**
     * - `process.env` snapshot configuration (Node mode). Independent of `platform`.
     * - `{ include: ["KEY"] }` — allowlist; only the listed keys are captured in `api.slothlet.env`. Non-string entries are silently ignored; an all-non-string array falls back to the full snapshot.
     * - Omitted / `null` — the full `process.env` snapshot is captured.
     */
    env?: object | null | undefined;
    /**
     * - Allowlist of environment variable names to capture. Only string entries are used.
     */
    include?: string[] | undefined;
    /**
     * - How leaf files are found and loaded.
     */
    loader?: {
        /**
         * - Injectable leaf importer: `(specifier: string) => Promise<object>`.
         * Every leaf module load is routed through it instead of slothlet's own dynamic `import()`, so the
         * modules land in the caller's module graph rather than slothlet's. Pass `(s) => import(s)` written
         * inside the consumer's own (transformed) code to make a coverage run attribute leaf execution
         * correctly; unset, slothlet imports natively. See [`docs/TESTING.md`](../docs/TESTING.md).
         */
        import?: Function | undefined;
        /**
         * - Pre-generated directory structure for browser mode.
         * Produced at build time by `files.generate()` from `@cldmv/slothlet/files`. Required when `loader.platform` is `"browser"`.
         * Giving it selects browser mode without an explicit `loader.platform`.
         */
        files?: {
            files: Array<{
                path: string;
                name: string;
                full: string;
            }>;
            directories: any[];
        } | undefined;
        /**
         * - When `mode: "lazy"`, immediately begins materializing all paths in the background after init. A function turns it on and is called once with `{ total, timestamp }` when everything has materialized — at once when that is already so when the instance finishes loading (always in eager mode). What it throws or rejects with is reported as a `WARNING_LIFECYCLE_HANDLER_ERROR` warning.
         */
        materialize?: boolean | Function | undefined;
        /**
         * - Execution-environment target. Controls whether filesystem-dependent code paths run. Independent of `env` (the `process.env` snapshot).
         * - `"browser"` — browser/worker/Electron-renderer mode. Skips filesystem operations and the `process.env` snapshot. Requires `loader.files`.
         * - `"node"` — explicit Node.js mode.
         * - Omitted — auto-detected: `"browser"` when `loader.files` is given (or no Node `process` is present), `"node"` otherwise.
         */
        platform?: "browser" | "node" | undefined;
        /**
         * - Browser-mode module resolver: `(fileEntry: {path, name, full}) => string | URL`.
         * Maps a file list entry to an importable URL or bare specifier. Defaults to resolving against `base` as a `file://` URL.
         * Override to point at a CDN, bundler virtual module, or other browser-friendly source.
         */
        resolve?: Function | undefined;
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
     * - Versioned api paths.
     */
    versioning?: {
        /**
         * - Version routing discriminator for versioned API paths.
         * - **string** (e.g. `"version"`) — at dispatch time, reads that key from the calling module's version metadata to select a version tag.
         * - **function** — called as `(allVersions, caller) => versionTag | null`; return a registered version tag to force routing, or `null`/`undefined` to fall through to the automatic default.
         * - **omitted / `undefined`** — behaves identically to `"version"`.
         * Only relevant when modules are registered via `api.slothlet.api.add()` with a `version` option.
         */
        dispatcher?: string | Function | null | undefined;
    } | undefined;
};
/**
 * Bound API object returned by `slothlet()`.
 * The root contains all loaded module exports plus the reserved `slothlet` namespace.
 */
export type SlothletAPI = {
    /**
     * - Like `shutdown()` but additionally invokes registered destroy hooks before teardown. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.destroy();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.destroy();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.destroy();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.destroy();%%
     */
    destroy: () => void;
    /**
     * - Convenience alias for `slothlet.shutdown()`. Shuts down the instance and invokes any user-provided shutdown hook first. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api' });|await api.shutdown();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api' });|  await api.shutdown();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api' });|  await api.shutdown();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api' });|await api.shutdown();%%
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
            leaves: Function;
            modules: {
                discover: Function;
                sort: Function;
                add: Function;
                remove: Function;
                cache: {
                    get: Function;
                    clear: Function;
                };
                stale: Function;
            };
        };
        context: {
            get: Function;
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
                 * - Get full cache diagnostic data (`{ caches[] }`). Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const cacheData = api.slothlet.diag.caches.get();|// { caches: [...] }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const cacheData = api.slothlet.diag.caches.get();|  // { caches: [...] }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const cacheData = api.slothlet.diag.caches.get();|  // { caches: [...] }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const cacheData = api.slothlet.diag.caches.get();|// { caches: [...] }%%
                 */
                get?: (() => Object) | undefined;
                /**
                 * - Return all moduleIDs currently in cache. Only available when `diagnostics: true`. %%sig: (): string[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const ids = api.slothlet.diag.caches.ids();|// ['utils/math.mjs', 'utils/strings.mjs']%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const ids = api.slothlet.diag.caches.ids();|  // ['utils/math.mjs', 'utils/strings.mjs']|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const ids = api.slothlet.diag.caches.ids();|  // ['utils/math.mjs', 'utils/strings.mjs']|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const ids = api.slothlet.diag.caches.ids();|// ['utils/math.mjs', 'utils/strings.mjs']%%
                 */
                ids?: (() => string[]) | undefined;
                /**
                 * - Check whether a cache entry exists for a given moduleID. Only available when `diagnostics: true`. %%sig: (moduleID: string): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false%%
                 */
                has?: Function | undefined;
            } | undefined;
            /**
             * - The `context` config value as passed to `slothlet()`.
             */
            context?: object | undefined;
            /**
             * - Describe API structure. Pass `true` to return the full API object; omit for top-level keys only. Only available when `diagnostics: true`. %%sig: ([showAll]: boolean): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const keys = api.slothlet.diag.describe();|const full = api.slothlet.diag.describe(true);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const keys = api.slothlet.diag.describe();|  const full = api.slothlet.diag.describe(true);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const keys = api.slothlet.diag.describe();|  const full = api.slothlet.diag.describe(true);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const keys = api.slothlet.diag.describe();|const full = api.slothlet.diag.describe(true);%%
             */
            describe?: Function | undefined;
            /**
             * - Return the live bound API proxy object. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const proxy = api.slothlet.diag.api(); // the live bound API proxy%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const proxy = api.slothlet.diag.api(); // the live bound API proxy|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const proxy = api.slothlet.diag.api(); // the live bound API proxy|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const proxy = api.slothlet.diag.api(); // the live bound API proxy%%
             */
            api?: (() => Object) | undefined;
            /**
             * - Hook system diagnostics sub-namespace (present only when hooks are enabled).
             */
            hook?: object | undefined;
            /**
             * - Return a full diagnostic snapshot of current instance state. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const snapshot = api.slothlet.diag.inspect();|console.log(snapshot.instance, snapshot.ownership);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const snapshot = api.slothlet.diag.inspect();|  console.log(snapshot.instance, snapshot.ownership);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const snapshot = api.slothlet.diag.inspect();|  console.log(snapshot.instance, snapshot.ownership);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const snapshot = api.slothlet.diag.inspect();|console.log(snapshot.instance, snapshot.ownership);%%
             */
            inspect?: (() => Object) | undefined;
            /**
             * - Ownership sub-namespace for diagnostics.
             */
            owner?: {
                /**
                 * - Get the owning moduleIDs for a specific API path. Only available when `diagnostics: true`. %%sig: (apiPath: string): string[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const owners = api.slothlet.diag.owner.get('math.add');|// ['utils/math.mjs']%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const owners = api.slothlet.diag.owner.get('math.add');|  // ['utils/math.mjs']|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const owners = api.slothlet.diag.owner.get('math.add');|  // ['utils/math.mjs']|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const owners = api.slothlet.diag.owner.get('math.add');|// ['utils/math.mjs']%%
                 */
                get?: Function | undefined;
                /**
                 * - Return ownership diagnostics for all registered API paths. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ base: './api', diagnostics: true });|const ownership = api.slothlet.diag.owner.list();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ base: './api', diagnostics: true });|  const ownership = api.slothlet.diag.owner.list();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ base: './api', diagnostics: true });|  const ownership = api.slothlet.diag.owner.list();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ base: './api', diagnostics: true });|const ownership = api.slothlet.diag.owner.list();%%
                 */
                list?: (() => Object) | undefined;
            } | undefined;
            /**
             * - The `reference` config value as passed to `slothlet()`.
             */
            reference?: object | undefined;
        } | undefined;
        hook: {
            clear: Function;
            disable: Function;
            enable: Function;
            list: Function;
            off: Function;
            on: Function;
            pattern: {
                enable: Function;
                disable: Function;
                reset: Function;
            };
            pin: {
                enabled: boolean;
                enable: Function;
                disable: Function;
            };
            remove: Function;
        };
        event: {
            on: Function;
            once: Function;
            off: Function;
            emit: Function;
            level: Function;
            rules: {
                add: Function;
                remove: Function;
            };
            strategy: Function;
            deliver: Function;
        };
        lifecycle: {
            off: Function;
            on: Function;
        };
        materialize: {
            get: () => Object;
            complete: boolean;
            wait: () => Promise<void>;
        };
        metadata: {
            caller: () => Object | null;
            get: Function;
            remove: Function;
            self: () => Object | null;
            set: Function;
            global: Function;
        };
        node: Function;
        owner: {
            get: Function;
        };
        warnings: {
            get: Function;
            clear: Function;
        };
        permissions: {
            rules: {
                add: Function;
                remove: Function;
            };
            global: {
                check: {
                    access: Function;
                    call: Function;
                };
                rules: {
                    path: Function;
                    module: Function;
                };
            };
            control: {
                mode: (arg0: ("on" | "off" | boolean) | undefined) => ("on" | "strict" | "off" | "disabled");
                gating: {
                    read: (arg0: boolean | undefined) => boolean;
                };
                seal: () => void;
                sealed: boolean;
                report: () => {
                    mode: string;
                    baseline: {
                        met: (boolean | null);
                        checks: Array<{
                            id: string;
                            met: boolean;
                            reason: (string | null);
                        }>;
                    };
                    capabilities: Array<{
                        name: string;
                        allowed: Array<string>;
                    }>;
                };
            };
        };
        versioning: {
            list: Function;
            default: Function;
            remove: Function;
            metadata: {
                get: Function;
                set: Function;
            };
        };
        pin: Function;
        bind: Function;
        reload: Function;
        restart: Function;
        shutdown: () => Promise<void>;
    };
};
//# sourceMappingURL=slothlet.d.mts.map