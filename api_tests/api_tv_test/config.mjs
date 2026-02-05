/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/config.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:15 -08:00 (1770266415)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

	get(key) {
		return key ? this._state[key] : { ...this._state };
	},

	/**
	 * Update configuration with new values
	 * @param {string|object} keyOrConfig - Key name or config object
	 * @param {*} [value] - Value if first param is key
	 * @returns {object} Success response with updated values
	 */
	update(keyOrConfig, value) {
		if (typeof keyOrConfig === "object") {
			// Update multiple values from object
			Object.assign(this._state, keyOrConfig);
			return { success: true, updated: keyOrConfig, instanceId: this._state.instanceId };
		} else {
			// Update single key-value pair
			this._state[keyOrConfig] = value;
			return { success: true, key: keyOrConfig, value, instanceId: this._state.instanceId };
		}
	},

	/**
	 * Set a single configuration value (alias for update)
	 * @param {string} key - Configuration key
	 * @param {*} value - Configuration value
	 * @returns {object} Success response
	 */
	set(key, value) {
		return this.update(key, value);
	},

	/**
	 * Get the current port or default
	 * @returns {number} Port number
	 */
	getDefaultPort() {
		return this._state.port || 3000;
	},

	/**
	 * Validate configuration object
	 * @param {object} configToValidate - Config to validate
	 * @param {string[]} [requiredKeys] - Required keys
	 * @returns {object} Validation result
	 */
	validate(configToValidate, requiredKeys = []) {
		const missing = requiredKeys.filter((key) => !(key in configToValidate));
		return {
			isValid: missing.length === 0,
			missing,
			config: configToValidate,
			instanceId: this._state.instanceId
		};
	},

	/**
	 * Merge user config with current state
	 * @param {object} [userConfig] - User configuration
	 * @param {string} [_] - Context (unused)
	 * @returns {object} Merged configuration
	 */
	merge(userConfig = {}, _ = "") {
		return { ...this._state, ...userConfig };
	},

	/**
	 * Create manufacturer-specific configuration
	 * @param {string} manufacturer - Manufacturer name
	 * @param {object} [options] - Additional options
	 * @returns {object} Manufacturer config
	 */
	createManufacturerConfig(manufacturer, options = {}) {
		return { manufacturer, ...this._state, ...options };
	},

	/**
	 * Get instance information for debugging
	 * @returns {object} Instance info
	 */
	getInstanceInfo() {
		return {
			instanceId: this._state.instanceId,
			currentState: { ...this._state },
			created: new Date().toISOString()
		};
	}
};

// Export named export
export { config };

// Export config object as default (IMPORTANT: This creates self-referential export)
export default config;

