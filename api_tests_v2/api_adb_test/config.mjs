/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_adb_test/config.mjs
 *	@Date: 2025-10-25 19:38:08 -07:00 (1761446288)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-04 04:35:32 -08:00 (1767530132)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Configuration data system API module for Android TV Remote.
 * Provides configuration management with get, set, merge, and defaults operations.
 * @module config
 */

// Slothlet runtime imports for live bindings
import { self as _, context } from "@cldmv/slothlet/runtime";

// Internal active configuration state
let activeConfig = {
	host: "test-device2"
};

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
export function get(key) {
	if (key) {
		return activeConfig[key] !== undefined ? activeConfig[key] : null;
	}

	// Return active config - defaults accessible via remote.utils.defaults
	return { ...activeConfig };
}

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
export function set(key, value) {
	if (typeof key === "object") {
		// Set multiple values
		Object.assign(activeConfig, key);

		// Update context for immediate effect
		Object.keys(key).forEach((k) => {
			if (Object.prototype.hasOwnProperty.call(context, k)) {
				context[k] = key[k];
			}
		});
	} else {
		// Set single value
		activeConfig[key] = value;

		// Update context for immediate effect
		if (Object.prototype.hasOwnProperty.call(context, key)) {
			context[key] = value;
		}
	}
}

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
export function merge(configObject, deep = false) {
	if (deep) {
		// Deep merge implementation
		function deepMerge(target, source) {
			for (const key in source) {
				if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
					target[key] = target[key] || {};
					deepMerge(target[key], source[key]);
				} else {
					target[key] = source[key];
				}
			}
			return target;
		}

		deepMerge(activeConfig, configObject);
	} else {
		// Shallow merge
		Object.assign(activeConfig, configObject);
	}

	// Update context for immediate effect
	Object.keys(configObject).forEach((key) => {
		if (Object.prototype.hasOwnProperty.call(context, key)) {
			context[key] = configObject[key];
		}
	});

	return get();
}

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
export function reset(keys) {
	// For now, just clear the active config
	// TODO: Use defaults system properly
	if (keys) {
		const keysArray = Array.isArray(keys) ? keys : [keys];
		keysArray.forEach((key) => {
			delete activeConfig[key];
		});
	} else {
		// Reset all
		activeConfig = {};
	}

	return get();
}

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
export function validate(configToValidate) {
	const config = configToValidate || get();
	const errors = [];

	// Validate required fields
	if (!config.host) {
		errors.push("host is required");
	}

	if (config.port && (config.port < 1 || config.port > 65535)) {
		errors.push("port must be between 1 and 65535");
	}

	if (config.heartbeatInterval && config.heartbeatInterval < 1000) {
		errors.push("heartbeatInterval must be at least 1000ms");
	}

	if (config.disconnectTimeout && config.disconnectTimeout < 1) {
		errors.push("disconnectTimeout must be at least 1 second");
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

/**
 * Gets a snapshot of the current configuration state.
 * @returns {Object} Configuration snapshot with metadata
 * @example
 * const snapshot = api.config.snapshot();
 * console.log('Config created:', snapshot.timestamp);
 */
export function snapshot() {
	return {
		timestamp: new Date().toISOString(),
		active: get(),
		validation: validate()
	};
}

// Initialize active config from context
if (context.providedConfig) {
	activeConfig = { ...context.providedConfig };
}

// Cached defaults API instance - created once when first accessed
let cachedDefaultsAPI = null;

function getDefaultsAPI() {
	if (!cachedDefaultsAPI) {
		cachedDefaultsAPI = self.utils.defaults.createDefaultsAPI(
			"config",
			() => get(),
			(values) => set(values)
		);
	}
	return cachedDefaultsAPI;
}

// Defaults API - methods access cached instance
const defaultsAPI = {
	get: (key) => getDefaultsAPI().get(key),
	getAll: () => getDefaultsAPI().getAll(),
	restore: (key) => getDefaultsAPI().restore(key),
	isDefault: (key) => getDefaultsAPI().isDefault(key),
	customized: () => getDefaultsAPI().customized(),
	resetAll: () => getDefaultsAPI().resetAll()
};

export const defaults = defaultsAPI;

// Default export object
// const config = {
// 	get,
// 	set,
// 	merge,
// 	reset,
// 	validate,
// 	snapshot,
// 	defaults: defaultsAPI
// };

export default activeConfig;
// export default config;
