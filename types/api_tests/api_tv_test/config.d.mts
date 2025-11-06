export default config;
export namespace config {
    namespace _state {
        let manufacturer: string;
        let host: string;
        let port: number;
        let instanceId: string;
    }
    /**
     * Get configuration value(s)
     * @param {string} [key] - Specific key to get, or undefined to get all
     * @returns {*} The value or entire config object
     */
    function get(key?: string): any;
    /**
     * Update configuration with new values
     * @param {string|object} keyOrConfig - Key name or config object
     * @param {*} [value] - Value if first param is key
     * @returns {object} Success response with updated values
     */
    function update(keyOrConfig: string | object, value?: any): object;
    /**
     * Set a single configuration value (alias for update)
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     * @returns {object} Success response
     */
    function set(key: string, value: any): object;
    /**
     * Get the current port or default
     * @returns {number} Port number
     */
    function getDefaultPort(): number;
    /**
     * Validate configuration object
     * @param {object} configToValidate - Config to validate
     * @param {string[]} [requiredKeys] - Required keys
     * @returns {object} Validation result
     */
    function validate(configToValidate: object, requiredKeys?: string[]): object;
    /**
     * Merge user config with current state
     * @param {object} [userConfig] - User configuration
     * @param {string} [_] - Context (unused)
     * @returns {object} Merged configuration
     */
    function merge(userConfig?: object, _?: string): object;
    /**
     * Create manufacturer-specific configuration
     * @param {string} manufacturer - Manufacturer name
     * @param {object} [options] - Additional options
     * @returns {object} Manufacturer config
     */
    function createManufacturerConfig(manufacturer: string, options?: object): object;
    /**
     * Get instance information for debugging
     * @returns {object} Instance info
     */
    function getInstanceInfo(): object;
}
//# sourceMappingURL=config.d.mts.map