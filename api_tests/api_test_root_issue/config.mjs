/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/config.mjs
 *	@Date: 2025-10-10 10:04:15 -07:00 (1760115855)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-24 11:26:00 -07:00 (1761330360)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Shared Configuration API Endpoint
 * Provides common configuration and utilities for all TV manufacturers.
 * Accessible via api.config
 */

import { context } from "@cldmv/slothlet/runtime";

/**
 * Config API object containing all configuration functions
 */
export const config = {
	/**
	 * Default configuration values for TV control
	 */
	defaults: {
		// TV identification
		manufacturer: "lg",

		// Connection settings
		host: null,
		port: null, // Will be set based on manufacturer
		connectionTimeout: 65000,
		reconnectAttempts: 3,
		reconnectDelay: 1000,

		// Volume settings
		maxVolume: 100,

		// Queue settings
		queueConcurrency: 1,
		queueInterval: 100,
		queueIntervalCap: 1,

		// State management settings
		"state.refreshDelayMs": 5000,

		// Logging settings
		logLevel: "info",
		logLevels: ["error", "warn", "info", "debug"],

		// Manufacturer-specific defaults
		"lg.activeKeycode": null,

		// Common TV ports by manufacturer
		ports: {
			lg: 9761,
			sony: 20060,
			samsung: 8001,
			philips: 1925
		}
	},

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
	getConfig(key) {
		const config = context?.options || {};

		if (!key) {
			return config;
		}

		// Support dot notation for nested keys
		return key.split(".").reduce((obj, prop) => obj?.[prop], config);
	},

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
	update(keyOrConfig, value) {
		if (!context?.tvControl) {
			return;
		}

		let configUpdate;

		if (typeof keyOrConfig === "string") {
			// Handle dot notation for single key update
			configUpdate = {};
			const keys = keyOrConfig.split(".");
			let current = configUpdate;

			// Prevent prototype pollution by blocking dangerous keys
			const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"];

			for (let i = 0; i < keys.length - 1; i++) {
				const key = keys[i];
				if (FORBIDDEN_KEYS.includes(key)) {
					// Silently ignore forbidden keys to prevent prototype pollution
					return;
				}
				current[key] = {};
				current = current[key];
			}

			const finalKey = keys[keys.length - 1];
			if (FORBIDDEN_KEYS.includes(finalKey)) {
				// Silently ignore forbidden keys to prevent prototype pollution
				return;
			}
			current[finalKey] = value;

			// For simple keys, also set at root level
			if (keys.length === 1) {
				configUpdate[keyOrConfig] = value;
			} else {
				// For dot notation, also set the flattened key
				configUpdate[keyOrConfig] = value;
			}
		} else {
			configUpdate = keyOrConfig;
		}

		context.tvControl.updateConfig(configUpdate);
	},

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
	set(key, value) {
		return this.update(key, value);
	},

	/**
	 * Get the default port for a specific manufacturer
	 * @param {string} manufacturer - Manufacturer name (lg, sony, samsung, etc.)
	 * @returns {number} Default port number
	 */
	getDefaultPort(_) {
		return 3000;
	},

	/**
	 * Validate that required configuration is present
	 * @param {Object} config - Configuration to validate
	 * @param {string[]} required - Required configuration keys
	 * @returns {Object} Validation result
	 */
	validate(config, required = []) {
		const missing = [];
		const invalid = [];

		for (const key of required) {
			if (!(key in config)) {
				missing.push(key);
			} else if (config[key] === null || config[key] === undefined || config[key] === "") {
				invalid.push(key);
			}
		}

		const isValid = missing.length === 0 && invalid.length === 0;

		return {
			isValid,
			missing,
			invalid,
			message: isValid ? "Configuration is valid" : `Configuration issues: missing [${missing.join(", ")}], invalid [${invalid.join(", ")}]`
		};
	},

	/**
	 * Get a merged configuration with defaults
	 * @param {Object} userConfig - User-provided configuration
	 * @param {string} manufacturer - Manufacturer name
	 * @returns {Object} Merged configuration
	 */
	merge(userConfig = {}, _ = "") {
		const merged = {
			...userConfig
		};

		return merged;
	},

	/**
	 * Create a manufacturer-specific configuration
	 * @param {string} manufacturer - Manufacturer name
	 * @param {Object} options - Manufacturer-specific options
	 * @returns {Object} Manufacturer configuration
	 */
	createManufacturerConfig(manufacturer, options = {}) {
		const baseConfig = this.getConfig();

		return this.merge(
			{
				...baseConfig,
				...options,
				manufacturer: manufacturer.toLowerCase()
			},
			manufacturer
		);
	}
};

// Export config object as default
export default config;
