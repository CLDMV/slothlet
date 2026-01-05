/**
 * @fileoverview Root-level config module for testing addApi flattening
 */

/**
 * Gets the configuration value
 * @returns {string} Configuration value
 */
export function getConfig() {
	return "root-test-config-value";
}

export default {
	value: "root-default-config",
	getConfig
};
