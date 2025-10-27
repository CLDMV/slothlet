/**
 * Gets configuration values.
 * @param {string} [key] - Specific config key to get, or undefined for entire config
 * @returns {any} Configuration value(s)
 * @example
 * // Get entire config
 * const config = api.config.get();
 *
 * // Get specific value
 * const host = api.config.get('host');
 */
export function get(key?: string): any;
/**
 * Sets a configuration value.
 * @param {string|Object} key - Config key to set, or object of key-value pairs
 * @param {any} [value] - Value to set (if key is string)
 * @returns {void}
 * @example
 * // Set single value
 * api.config.set('quiet', true);
 *
 * // Set multiple values
 * api.config.set({
 *   quiet: true,
 *   heartbeatInterval: 60000
 * });
 */
export function set(key: string | any, value?: any): void;
/**
 * Merges configuration values with existing config.
 * @param {Object} configObject - Configuration object to merge
 * @param {boolean} [deep=false] - Whether to perform deep merge
 * @returns {Object} Updated configuration
 * @example
 * // Shallow merge
 * api.config.merge({ quiet: true, port: 5556 });
 *
 * // Deep merge
 * api.config.merge({ advanced: { timeout: 10000 } }, true);
 */
export function merge(configObject: any, deep?: boolean): any;
/**
 * Gets default configuration values.
 * @param {string} [key] - Specific default key to get, or undefined for all defaults
 * @returns {any} Default configuration value(s)
 * @example
 * // Get all defaults
 * const defaults = api.config.defaults();
 *
 * // Get specific default
 * const defaultPort = api.config.defaults('port');
 */
export function defaults(key?: string): any;
/**
 * Resets configuration to defaults.
 * @param {string|string[]} [keys] - Specific keys to reset, or undefined to reset all
 * @returns {Object} Updated configuration
 * @example
 * // Reset all to defaults
 * api.config.reset();
 *
 * // Reset specific keys
 * api.config.reset(['quiet', 'port']);
 * api.config.reset('host');
 */
export function reset(keys?: string | string[]): any;
/**
 * Validates configuration values.
 * @param {Object} [configToValidate] - Config to validate, or current config if not provided
 * @returns {Object} Validation result with isValid boolean and errors array
 * @example
 * const validation = api.config.validate();
 * if (!validation.isValid) {
 *   console.log('Config errors:', validation.errors);
 * }
 */
export function validate(configToValidate?: any): any;
/**
 * Gets a snapshot of the current configuration state.
 * @returns {Object} Configuration snapshot with metadata
 * @example
 * const snapshot = api.config.snapshot();
 * console.log('Config created:', snapshot.timestamp);
 */
export function snapshot(): any;
export default config;
declare namespace config {
    export { get };
    export { set };
    export { merge };
    export { defaults };
    export { reset };
    export { validate };
    export { snapshot };
    export { defaultAPI as default };
}
declare const defaultAPI: any;
//# sourceMappingURL=config.d.mts.map