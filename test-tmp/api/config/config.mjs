/**
 * @fileoverview Test configuration module for Rule C13 testing
 * @module test-tmp/api/config/config
 */

/**
 * Returns the configuration value.
 * @returns {string} The configuration value
 */
export function getConfig() {
	return "test-config-value";
}

/**
 * Default export for the config module.
 * @returns {object} Configuration object
 */
export default {
	value: "default-config",
	getConfig
};
