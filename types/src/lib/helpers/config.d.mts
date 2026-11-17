/**
 * Normalize the `hook` config into a canonical `{ enabled, pattern, errors, pin }` object.
 *
 * Accepts the boolean form (enable/disable with the catch-all pattern), the string form
 * (enable, restricting hooks to a global path pattern — e.g. `"database.*"`), or the full
 * object form. Idempotent: an already-normalized object normalizes to an equivalent object,
 * so `reload()` can re-feed it.
 *
 * Exported as a standalone function (not just a {@link Config} method) because the HookManager
 * is constructed during `_initializeComponents` — BEFORE `transformConfig` runs — so it cannot
 * rely on the normalized config being in place yet, and must normalize the raw `config.hook`
 * itself from the same source of truth.
 *
 * @param {boolean|string|Object} [hook] - Raw hook config in any supported form.
 * `errors` is `"suppress"` (a hook error is reported to the error hooks and not thrown) or `false`; `true` is the
 * boolean form of `"suppress"`.
 *
 * @returns {{enabled: boolean, pattern: (string|null), errors: ("suppress"|false), pin: boolean}} Normalized hook config.
 * @throws {SlothletError} INVALID_CONFIG when `hook.errors` is not `"suppress"`, `true` or `false`.
 * @public
 */
export function normalizeHookConfig(hook?: boolean | string | Object): {
    enabled: boolean;
    pattern: (string | null);
    errors: ("suppress" | false);
    pin: boolean;
};
/**
 * Build an instance's clock from the host's `clock` option.
 * The option is read once, when the instance is created, and kept by the instance alone: it is never part of the
 * normalised config an instance hands out, so only the host that creates the instance can supply it.
 * @param {{now?: Function, set?: Function, clear?: Function}} [clock] - The option as given. Each member is optional and must be
 *   a function; one left out is the copy slothlet took when it loaded. Absent means no `clock` option at all.
 * @returns {object} The frozen clock `{ now, setTimeout, clearTimeout, hostTimers }` (`set` and `clear` as the timer functions).
 * @throws {SlothletError} INVALID_CONFIG when it is not an object whose given members are functions.
 * @public
 * @example
 * normalizeClockConfig({ now: () => 1000 }).now(); // => 1000
 */
export function normalizeClockConfig(clock?: {
    now?: Function;
    set?: Function;
    clear?: Function;
}): object;
/**
 * Expand the `permissions` shorthand forms to the object form.
 *
 * `"on"`, `"off"` and `"disabled"` mean `{ mode }`; `true` means `"on"`; `false` and any other falsy value mean no `permissions` config (off). An object, `null`
 * and `undefined` come back as they are. Any other string, and any other value that is not an object, comes back as
 * `undefined` with `valid: false`, so a bare value never quietly reads as a different mode than it names.
 *
 * Exported as a standalone function because the PermissionManager is constructed during `_initializeComponents`,
 * before `transformConfig` runs, and must read the same shorthand from the raw config. It does not throw: the
 * config normalizer reports the invalid value as `INVALID_CONFIG` right after.
 *
 * @param {*} permissions - Raw `permissions` option.
 * @returns {{value: (object|null|undefined), valid: boolean}} The object form (or the absent value), and whether the input was a form `permissions` accepts.
 * @public
 *
 * @example
 * expandPermissionsShorthand("disabled"); // => { value: { mode: "disabled" }, valid: true }
 * expandPermissionsShorthand("nope"); // => { value: undefined, valid: false }
 */
export function expandPermissionsShorthand(permissions: any): {
    value: (object | null | undefined);
    valid: boolean;
};
/**
 * Normalize the `permissions` option to its full object form (or `null` for no permissions config).
 *
 * The normalized form has the same shape as the option, every member filled in, so feeding it back in (a reload)
 * gives the same result.
 *
 * @param {object|string|boolean|null} [permissions] - Raw permissions config from user. A bare `"on"`, `"strict"`, `"off"` or `"disabled"` means `{ mode }`; `true` and `false` mean `"on"` and `"off"`.
 * @param {"allow"|"deny"} [permissions.policy="allow"] - What a call no rule decides gets.
 * @param {"on"|"strict"|"off"|"disabled"|boolean} [permissions.mode="on"] - `"on"` (the default for a `permissions` block): every rule
 *   applies. `"strict"`: as `"on"`, chosen in the config only (it cannot be left at runtime), and the instance refuses to
 *   start while a check of the permission baseline is not met (docs/PERMISSIONS.md). `"off"`: only the built-in rules that keep module code off the framework's own namespace, root
 *   functions, and keys on api nodes apply (as with no `permissions` config at all). `"disabled"`: nothing applies.
 *   `true` and `false` mean `"on"` and `"off"`.
 * @param {string|boolean} [permissions.audit="default"] - Audit level: `"default"` (denied + self-bypass only),
 *   `"verbose"` (all decisions). `true` and `false` are accepted and both normalize to `"default"`.
 * @param {object} [permissions.caller] - How the caller of a call or read is identified.
 * @param {boolean} [permissions.caller.anonymous=false] - When `false` (the default), calls and reads occurring inside an
 *   active context with no resolvable (or forged) caller identity fail closed (denied); only genuinely host-initiated
 *   calls are exempt. `true` lets them through.
 * @param {"precise"|"fast"} [permissions.caller.attribution="precise"] - How the definer of code a module hands out is
 *   known (#726). `"precise"` (the default) wraps a returned value that is itself code to record its definer; `"fast"`
 *   wraps nothing and tells every definer from the stack.
 * @param {boolean} [permissions.caller.capture=true] - When `true` (the default), a function read out of the api carries
 *   the identity of the module that read it, so it stays enforced as that module wherever it is later invoked.
 * @param {"leaf"|"chain"} [permissions.caller.ceiling="leaf"] - Code a caller hands to a leaf runs as the caller with the
 *   leaf as its ceiling (#597). With `"leaf"` (the default) that ceiling is the leaf the code is running inside;
 *   with `"chain"` it accumulates across every leaf the code was handed through, and all of them are enforced.
 * @param {boolean} [permissions.caller.provenance=true] - Code is told apart by where it was written: a module's function
 *   running inside another module's call, reached by a route slothlet does not see, runs as that module with the
 *   call as its ceiling (#597). `false` turns this off.
 * @param {object} [permissions.gating] - What is gated besides calls.
 * @param {boolean|number} [permissions.gating.buffers=false] - Whether a typed array or `Buffer` one module hands
 *   another is checked for members of its own under string keys. `false` never lists its keys, `true` always does,
 *   a whole number lists arrays of up to that many kilobytes.
 * @param {boolean} [permissions.gating.read=true] - When `true` (the default), reading a terminal data value off a module
 *   API path is permission-checked, the same way calls are.
 * @param {boolean} [permissions.owner=false] - When `true`, a caller leaf may access any target leaf currently owned by
 *   the same module, across directories, where the policy would otherwise deny. An explicit deny rule still wins (#509).
 * @param {Array<object>} [permissions.rules=[]] - Initial permission rules.
 * @returns {object|null} Normalized permissions config, or null when permissions is absent or off by shorthand.
 * @public
 *
 * @example
 * normalizePermissionsConfig({ policy: "deny", rules: [{ caller: "**", target: "admin.**", effect: "deny" }] });
 * // => { policy: "deny", mode: "on", audit: "default", caller: { anonymous: false, ... }, gating: { buffers: false, read: true }, ... }
 */
export function normalizePermissionsConfig(permissions?: object | string | boolean | null): object | null;
/**
 * Configuration normalization utilities
 * @class Config
 * @extends ComponentBase
 * @public
 */
export class Config extends ComponentBase {
    static slothletProperty: string;
    /**
     * Normalize collision configuration for handling property collisions
     * @param {string|Object} collision - Collision mode or object with per-context modes
     * @returns {Object} Normalized collision configuration with initial and api.slothlet.api.add modes
     * @public
     *
     * @description
     * Normalizes collision handling configuration for both initial load (buildAPI)
     * and hot reload (api.add) contexts. Supports six collision modes:
     * - "skip": Silently ignore collision, keep existing value
     * - "warn": Warn about collision, keep existing value
     * - "replace": Replace existing value completely
     * - "merge": Merge properties (preserve original + add new)
     * - "merge-replace": Merge properties (add new + overwrite existing with new values)
     * - "error": Throw error on collision
     *
     * @example
     * // String shorthand applies to both contexts
     * normalizeCollision("merge")
     * // => { initial: "merge", api: "merge" }
     *
     * @example
     * // Object allows per-context control
     * normalizeCollision({ initial: "warn", api: "error" })
     * // => { initial: "warn", api: "error" }
     */
    public normalizeCollision(collision: string | Object): Object;
    /**
     * Normalize runtime input to internal standard format
     * @param {string} runtime - Input runtime type (various formats accepted)
     * @returns {string} Normalized runtime type ("async" or "live")
     * @public
     */
    public normalizeRuntime(runtime: string): string;
    /**
     * Normalize mode input to internal standard format
     * @param {string} mode - Input mode type (various formats accepted)
     * @returns {string} Normalized mode type ("eager" or "lazy")
     * @public
     */
    public normalizeMode(mode: string): string;
    /**
     * Validate the `helpers` option: how often a helper file (a file an api file imports that is no api file itself)
     * is loaded.
     * @param {*} helpers - The option as given.
     * @returns {"instance"|"module"} `"instance"` (the default: one copy per instance, shared by every api file
     *   importing it) or `"module"` (one copy per importing api file).
     * @throws {SlothletError} INVALID_CONFIG for any other value.
     * @public
     * @example
     * config.normalizeHelpers(undefined); // "instance"
     */
    public normalizeHelpers(helpers: any): "instance" | "module";
    /**
     * Normalize mutations configuration for API modification control
     * @param {Object} mutations - Mutations config object with add/remove/reload properties
     * @returns {Object} Normalized mutations configuration
     * @public
     *
     * @description
     * Normalizes mutation control configuration for API runtime modifications.
     * Controls whether api.slothlet.api.add(), api.slothlet.api.remove(), and
     * api.slothlet.reload() operations are allowed.
     *
     * @example
     * // Allow all mutations (default)
     * normalizeMutations({ add: true, remove: true, reload: true })
     * // => { add: true, remove: true, reload: true }
     *
     * @example
     * // Disable all mutations
     * normalizeMutations({ add: false, remove: false, reload: false })
     * // => { add: false, remove: false, reload: false }
     */
    public normalizeMutations(mutations: Object): Object;
    /**
     * Normalize debug configuration
     * @param {boolean|Object} debug - Debug flag or object with targeted flags
     * @returns {Object} Normalized debug object with all flags
     * @public
     */
    public normalizeDebug(debug: boolean | Object): Object;
    /**
     * Normalize execution-environment target from the raw `platform` config value.
     *
     * @description
     * Distinct from `normalizeEnv()` which handles the `process.env` snapshot
     * allowlist (`config.env`). This method determines *where* slothlet is executing
     * so that filesystem-dependent code paths can be bypassed in browser/worker builds.
     *
     * When `platform` is omitted the method auto-detects by checking whether
     * `process.versions.node` is available (true in Node.js; absent or undefined
     * in browsers, web workers, and Electron renderers without nodeIntegration).
     * Pass `"browser"` or `"node"` to override auto-detection for edge cases
     * (e.g. Deno, Electron with custom process polyfills).
     *
     * @param {*} platform - Raw value of `config.platform` before normalisation.
     * @returns {"browser"|"node"} Execution-environment target.
     * @public
     *
     * @example
     * normalizeEnvTarget("browser"); // => "browser" (explicit override)
     * normalizeEnvTarget("node");    // => "node"    (explicit override)
     * normalizeEnvTarget(undefined); // => "browser" or "node" (auto-detected)
     */
    public normalizeEnvTarget(platform: any, hasManifest?: boolean): "browser" | "node";
    /**
     * Normalize the `hook` config into a canonical `{ enabled, pattern, errors, pin }` object.
     *
     * Accepts the boolean form (enable/disable with the catch-all pattern), the string form
     * (enable, restricting hooks to a global path pattern — e.g. `"database.*"`), or the full
     * object form. Idempotent: an already-normalized object normalizes to an equivalent object,
     * so `reload()` can re-feed it. Shared by {@link transformConfig} and the HookManager so both
     * derive the same values regardless of construction order (the manager is built before
     * transformConfig runs, so it cannot rely on the normalized config being in place yet).
     *
     * @param {boolean|string|Object} [hook] - Raw hook config in any supported form.
     * @returns {{enabled: boolean, pattern: (string|null), errors: ("suppress"|false), pin: boolean}} Normalized hook config.
     * @public
     */
    public normalizeHook(hook?: boolean | string | Object): {
        enabled: boolean;
        pattern: (string | null);
        errors: ("suppress" | false);
        pin: boolean;
    };
    /**
     * Normalize the `api.collision` group: `{ mode, override }`, or a bare mode string as the shorthand for `{ mode }`.
     * @param {string|{mode?: (string|{initial?: string, api?: string}), override?: boolean}} [collision] - The group as given.
     * @returns {{mode: {initial: string, api: string}, override: boolean}} The normalized group.
     * @throws {SlothletError} INVALID_CONFIG when it is neither a string nor an object, or `override` is not a boolean.
     * @public
     * @example
     * config.normalizeApiCollision("warn"); // => { mode: { initial: "warn", api: "warn" }, override: false }
     */
    public normalizeApiCollision(collision?: string | {
        mode?: (string | {
            initial?: string;
            api?: string;
        });
        override?: boolean;
    }): {
        mode: {
            initial: string;
            api: string;
        };
        override: boolean;
    };
    /**
     * Normalize the `loader` group: how leaf files are found and loaded.
     * @param {object} [loader] - The group as given.
     * @param {Function} [loader.import] - Every leaf load goes through it: `(specifier) => Promise<module>`.
     * @param {{files: Array, directories: Array}} [loader.files] - The browser file list (`files.generate()`); giving one
     *   selects browser mode.
     * @param {boolean} [loader.materialize=false] - Lazy mode: materialize every path in the background after init.
     * @param {"node"|"browser"} [loader.platform] - Where slothlet runs; auto-detected when omitted.
     * @param {Function} [loader.resolve] - Browser: a file list entry to an importable URL.
     * @returns {{import: (Function|null), files: (object|null), materialize: boolean, platform: ("node"|"browser"), resolve: (Function|null)}}
     *   The normalized group.
     * @throws {SlothletError} INVALID_CONFIG_IMPORT when `import` is given and is not a function.
     * @public
     * @example
     * config.normalizeLoader({}); // => { import: null, files: null, materialize: false, platform: "node", resolve: null }
     */
    public normalizeLoader(loader?: {
        import?: Function | undefined;
        files?: {
            files: any[];
            directories: any[];
        } | undefined;
        materialize?: boolean | undefined;
        platform?: "browser" | "node" | undefined;
        resolve?: Function | undefined;
    }): {
        import: (Function | null);
        files: (object | null);
        materialize: boolean;
        platform: ("node" | "browser");
        resolve: (Function | null);
    };
    /**
     * Normalize the `routines` group (object form only).
     * @param {object} [routines] - The group as given.
     * @param {boolean} [routines.auto=false] - Startup/shutdown/destroy routines fire by themselves.
     * @param {Array} [routines.entries] - The routines; see {@link Config#normalizeRoutines}. Omitted keeps the defaults.
     * @param {boolean} [routines.stack=false] - Every module contributing the same routine name at one api path runs, in
     *   mount order; `false` runs only the collision winner.
     * @returns {{auto: boolean, entries: Array<object>, stack: boolean}} The normalized group.
     * @throws {SlothletError} INVALID_CONFIG when it is not an object, or a member is invalid.
     * @public
     * @example
     * config.normalizeRoutinesGroup({ auto: true }).auto; // true
     */
    public normalizeRoutinesGroup(routines?: {
        auto?: boolean | undefined;
        entries?: any[] | undefined;
        stack?: boolean | undefined;
    }): {
        auto: boolean;
        entries: Array<object>;
        stack: boolean;
    };
    /**
     * Transform and validate configuration.
     *
     * The result has the shape of the option object (`slothlet({...})`) with every group filled in, so feeding it back in
     * (a reload) gives the same result.
     * @param {Object} config - Raw configuration options
     * @returns {Object} Normalized configuration
     * @throws {SlothletError} If configuration is invalid
     * @public
     */
    public transformConfig(config?: Object): Object;
    /**
     * Normalize TypeScript configuration
     * @param {boolean|string|Object} typescript - TypeScript config (true, "fast", or { mode: "fast"|"strict", ... })
     * @returns {Object|null} Normalized TypeScript configuration or null if disabled
     * @public
     */
    public normalizeTypeScript(typescript: boolean | string | Object): Object | null;
    /**
     * Normalize env snapshot configuration.
     *
     * @description
     * Validates the `env` option from user config. When `include` is a non-empty
     * string array, returns `{ include }` (the allowlist used by `_captureEnvSnapshot`).
     * Any other value — including `undefined`, `null`, `{}`, or an empty `include`
     * array — is normalised to `null`, meaning the full `process.env` snapshot is used.
     *
     * @param {Object|null|undefined} env - Raw env option from user config.
     * @param {string[]} [env.include] - Allowlist of env variable names to capture.
     * @returns {{ include: string[] }|null} Normalized env config, or `null` for full snapshot.
     * @public
     *
     * @example
     * // No restriction — full snapshot
     * normalizeEnv(undefined); // => null
     * normalizeEnv(null);      // => null
     * normalizeEnv({});        // => null
     *
     * @example
     * // Include allowlist
     * normalizeEnv({ include: ["NODE_ENV", "PORT"] });
     * // => { include: ["NODE_ENV", "PORT"] }
     *
     * @example
     * // Non-string keys in the include array are filtered out
     * normalizeEnv({ include: ["NODE_ENV", 42, null] });
     * // => { include: ["NODE_ENV"] }
     */
    public normalizeEnv(env: Object | null | undefined): {
        include: string[];
    } | null;
    /**
     * Normalize + validate the construction-time `lifecycle` subscription map (#148).
     *
     * @description
     * The `lifecycle` option registers event handlers on the Lifecycle emitter BEFORE the api builds,
     * so events emitted during cold-start `buildAPI` (init-time `impl:warning` / `impl:created` / …)
     * are observable. It is a plain object mapping an event name to a handler function or an array of
     * handler functions. Any event name is accepted — registration is just early `subscribe()` calls,
     * so these handlers also receive runtime events afterward.
     *
     * Idempotent: an already-normalized map (values already functions / arrays of functions) passes
     * through unchanged, so `reload()` can re-feed it.
     *
     * @param {object|null|undefined} lifecycle - Raw `lifecycle` option from user config.
     * @returns {object|null} The validated map, or `null` when absent.
     * @throws {SlothletError} INVALID_CONFIG when the shape is not a plain object of functions / function arrays.
     * @public
     *
     * @example
     * normalizeLifecycle({ "impl:warning": (data) => log(data) });
     * // => { "impl:warning": (data) => log(data) }
     *
     * @example
     * normalizeLifecycle({ "impl:error": [onError, auditError] });
     * // => { "impl:error": [onError, auditError] }
     */
    public normalizeLifecycle(lifecycle: object | null | undefined): object | null;
    /**
     * Normalize + validate the `routines` config option (#341).
     *
     * @description
     * A routine is a named cross-module runnable: every mounted module that exports a function
     * matching a configured routine name gets stacked into one chain at its resolved api path, and
     * a root cascade runs every matching contribution anywhere, ordered per the entry's `order`.
     * See `docs/LIFECYCLE.md` ("Routines") for the full contract.
     *
     * Each entry normalizes to `{ name, mode, recursive, order, cascade }` — `recursive`, `order` and
     * `cascade` are always present on the normalized output, even when the raw entry omitted them:
     * - `"name"` (string, no `:`) → `{ name, mode: "manual", recursive: false, order: "mount", cascade: true }`.
     * - `"name:mode"` (string, split once on the first `:`) → `{ name, mode, recursive: false, order: <mode-defaulted>, cascade: true }`.
     * - `{ name, mode?, recursive?, order?, cascade? }` (object) → `mode` defaults to `"manual"`, `recursive`
     *   to `false`, `order` to {@link DEFAULT_ROUTINE_ORDER_BY_MODE}`[mode]`, and `cascade` to `true` when each
     *   is omitted. `cascade: false` (#400) suppresses the root `api.<name>()` run-all cascade for that routine.
     *
     * Providing `routines` at all REPLACES {@link DEFAULT_ROUTINES} — that is the off-switch
     * (`routines: []` disables every routine). Omitting the option keeps the built-in defaults.
     * `slothlet.defaults.routines` is the frozen source of those defaults, exported for a consumer
     * to spread (extend) or filter (drop one) rather than replace wholesale.
     *
     * Idempotent: an already-normalized list (every entry already `{ name, mode, recursive, order }`)
     * normalizes to an equivalent list — same values, always freshly-built objects (never the same
     * references) — so `reload()` can safely re-feed it.
     *
     * @param {undefined|null|Array<string|{name: string, mode?: string, recursive?: boolean, order?: string, cascade?: boolean}>} routines - Raw `routines` option.
     * @returns {Array<{name: string, mode: "manual"|"startup"|"shutdown"|"destroy", recursive: boolean, order: "mount"|"depth", cascade: boolean}>} Normalized routines list.
     * @throws {SlothletError} INVALID_CONFIG when the shape is invalid, a name is empty/reserved/an invalid glob, or a mode/order is unrecognized.
     * @public
     *
     * @example
     * normalizeRoutines(undefined);
     * // => [{ name: "initialize", mode: "startup", recursive: false, order: "mount" },
     * //     { name: "shutdown", mode: "shutdown", recursive: false, order: "depth" }]
     *
     * @example
     * normalizeRoutines(["launch", "prefetch:startup", { name: "warmup" }]);
     * // => [{ name: "launch", mode: "manual", recursive: false, order: "mount" },
     * //     { name: "prefetch", mode: "startup", recursive: false, order: "mount" },
     * //     { name: "warmup", mode: "manual", recursive: false, order: "mount" }]
     *
     * @example
     * normalizeRoutines([]);
     * // => [] — disables every routine
     */
    public normalizeRoutines(routines: undefined | null | Array<string | {
        name: string;
        mode?: string;
        recursive?: boolean;
        order?: string;
        cascade?: boolean;
    }>): Array<{
        name: string;
        mode: "manual" | "startup" | "shutdown" | "destroy";
        recursive: boolean;
        order: "mount" | "depth";
        cascade: boolean;
    }>;
    /**
     * Normalize permissions configuration: see {@link normalizePermissionsConfig}.
     *
     * @param {object|string|boolean|null} [permissions] - Raw permissions config from user.
     * @returns {object|null} Normalized permissions config, or null when permissions is absent or not an object.
     * @example
     * config.normalizePermissions("disabled"); // => { mode: "disabled", enabled: false, ... }
     */
    normalizePermissions(permissions?: object | string | boolean | null): object | null;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=config.d.mts.map