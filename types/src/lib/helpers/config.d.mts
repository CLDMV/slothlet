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
     * Normalize execution-environment target from the raw `env` config value.
     *
     * @description
     * Distinct from `normalizeEnv()` which handles the `process.env` snapshot
     * allowlist. This method determines *where* slothlet is executing so that
     * filesystem-dependent code paths can be bypassed in browser/worker builds.
     *
     * When `rawEnv` is omitted the method auto-detects by checking whether
     * `process.versions.node` is available (true in Node.js; absent or undefined
     * in browsers, web workers, and Electron renderers without nodeIntegration).
     * Pass `"browser"` or `"node"` to override auto-detection for edge cases
     * (e.g. Deno, Electron with custom process polyfills).
     *
     * @param {*} rawEnv - Raw value of `config.env` before normalisation.
     * @returns {"browser"|"node"} Execution-environment target.
     * @public
     *
     * @example
     * normalizeEnvTarget("browser"); // => "browser" (explicit override)
     * normalizeEnvTarget("node");    // => "node"    (explicit override)
     * normalizeEnvTarget(undefined); // => "browser" or "node" (auto-detected)
     */
    public normalizeEnvTarget(rawEnv: any, hasManifest?: boolean): "browser" | "node";
    /**
     * Transform and validate configuration
     * @param {Object} config - Raw configuration options
     * @returns {Object} Normalized configuration
     * @throws {SlothletError} If configuration is invalid
     * @public
     */
    public transformConfig(config?: Object): Object;
    /**
     * Normalize and validate the suppressFixes option. Emits a deprecation warning for each
     * rule ID present. Invalid entries (non-strings, unknown rule IDs) are silently dropped.
     *
     * @param {string[]|undefined} suppressFixes - Raw suppressFixes value from user config.
     * @param {boolean} silent - If true, suppress warnings.
     * @returns {Set<string>} Normalized set of suppressed rule IDs.
     * @example
     * // Rule IDs use the <rule>_<PR> form. The C03 fix landed in PR #116.
     * normalizeSuppressFixes(["C03_116"], false); // emits WARN_SUPPRESS_FIX_ACTIVE for C03_116
     * @public
     */
    public normalizeSuppressFixes(suppressFixes: string[] | undefined, silent: boolean): Set<string>;
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
     * Normalize permissions configuration.
     *
     * @param {object|null} [permissions] - Raw permissions config from user.
     * @param {string} [permissions.defaultPolicy="allow"] - Fallback policy: "allow" or "deny".
     * @param {boolean} [permissions.enabled=true] - Global toggle.
     * @param {string|boolean} [permissions.audit="default"] - Audit level: `"default"` (denied + self-bypass only),
     *   `"verbose"` (all decisions). `true` and `false` are accepted and both normalize to `"default"`.
     * @param {boolean} [permissions.readGating=true] - When `true` (the default), reading a terminal
     *   data value (primitive, Buffer, TypedArray, Date, Map, etc.) off a module API path is
     *   permission-checked, the same way calls are. Set `false` to opt out and gate calls only.
     * @param {Array<object>} [permissions.rules=[]] - Initial permission rules.
     * @returns {object|null} Normalized permissions config, or null when permissions is absent or not an object.
     *
     * @example
     * normalizePermissions({ defaultPolicy: "deny", rules: [{ caller: "**", target: "admin.**", effect: "deny" }] });
     * // => { defaultPolicy: "deny", enabled: true, audit: "default", readGating: true, rules: [...] }
     */
    normalizePermissions(permissions?: object | null): object | null;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=config.d.mts.map