export namespace config {
    let defaults: {
        manufacturer: string;
        host: any;
        port: any;
        connectionTimeout: number;
        reconnectAttempts: number;
        reconnectDelay: number;
        maxVolume: number;
        queueConcurrency: number;
        queueInterval: number;
        queueIntervalCap: number;
        "state.refreshDelayMs": number;
        logLevel: string;
        logLevels: string[];
        "lg.activeKeycode": any;
        ports: {
            lg: number;
            sony: number;
            samsung: number;
            philips: number;
        };
    };
    /**
     * Get configuration value by key or entire configuration object.
     * @param {string} [key] - Optional dot-notation key to get specific value
     * @returns {*} Configuration value or entire config object
     *
     * @description
     * Retrieves configuration from the TV Control instance. Supports dot notation
     * for nested values like 'lg.activeKeycode' or 'state.refreshDelayMs'.
     *
     * @example
     * // Get entire config
     * const config = get();
     *
     * @example
     * // Get specific value
     * const manufacturer = get('manufacturer');
     * const keycode = get('lg.activeKeycode');
     */
    function getConfig(key?: string): any;
    /**
     * Update TV Control configuration.
     * @param {Object|string} keyOrConfig - Configuration object or dot-notation key
     * @param {*} [value] - Value to set (if keyOrConfig is a string)
     *
     * @description
     * Updates configuration either by merging an object or setting a specific key.
     * Supports dot notation for nested keys like 'lg.activeKeycode'.
     *
     * @example
     * // Update multiple values
     * update({ host: '192.168.1.100', maxVolume: 75 });
     *
     * @example
     * // Update specific nested value
     * update('lg.activeKeycode', '12345678');
     */
    function update(keyOrConfig: any | string, value?: any): void;
    /**
     * Set a configuration value (alias for update).
     * @param {string} key - Dot-notation key to set
     * @param {*} value - Value to set
     *
     * @description
     * Convenience function for setting a single configuration value.
     *
     * @example
     * set('manufacturer', 'samsung');
     * set('lg.activeKeycode', '87654321');
     */
    function set(key: string, value: any): void;
    /**
     * Get the default port for a specific manufacturer
     * @param {string} manufacturer - Manufacturer name (lg, sony, samsung, etc.)
     * @returns {number} Default port number
     */
    function getDefaultPort(_: any): number;
    /**
     * Validate that required configuration is present
     * @param {Object} config - Configuration to validate
     * @param {string[]} required - Required configuration keys
     * @returns {Object} Validation result
     */
    function validate(config: any, required?: string[]): any;
    /**
     * Get a merged configuration with defaults
     * @param {Object} userConfig - User-provided configuration
     * @param {string} manufacturer - Manufacturer name
     * @returns {Object} Merged configuration
     */
    function merge(userConfig?: any, _?: string): any;
    /**
     * Create a manufacturer-specific configuration
     * @param {string} manufacturer - Manufacturer name
     * @param {Object} options - Manufacturer-specific options
     * @returns {Object} Manufacturer configuration
     */
    function createManufacturerConfig(manufacturer: string, options?: any): any;
}
export default config;
//# sourceMappingURL=config.d.mts.map