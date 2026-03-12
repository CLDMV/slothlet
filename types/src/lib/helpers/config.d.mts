/**
 * Configuration normalization utilities
 * @class Config
 * @extends ComponentBase
 * @public
 */
export class Config {
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
    public normalizeCollision(collision: string | any): any;
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
    public normalizeMutations(mutations: any): any;
    /**
     * Normalize debug configuration
     * @param {boolean|Object} debug - Debug flag or object with targeted flags
     * @returns {Object} Normalized debug object with all flags
     * @public
     */
    public normalizeDebug(debug: boolean | any): any;
    /**
     * Transform and validate configuration
     * @param {Object} config - Raw configuration options
     * @returns {Object} Normalized configuration
     * @throws {SlothletError} If configuration is invalid
     * @public
     */
    public transformConfig(config?: any): any;
    /**
     * Normalize TypeScript configuration
     * @param {boolean|string|Object} typescript - TypeScript config (true, "fast", or { mode: "fast"|"strict", ... })
     * @returns {Object|null} Normalized TypeScript configuration or null if disabled
     * @public
     */
    public normalizeTypeScript(typescript: boolean | string | any): any | null;
}
//# sourceMappingURL=config.d.mts.map