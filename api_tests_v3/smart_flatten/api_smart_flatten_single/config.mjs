/**
 * Test folder for smart flattening Case 1: Single file matching API path
 * Scenario: addApi("config", "./config-folder") where folder contains only config.mjs
 * Expected: api.config.{functions} (not api.config.config.{functions})
 */

export function getConfig() {
	return "config-value";
}

export function setConfig(value) {
	return `Config set to: ${value}`;
}

export function validateConfig() {
	return true;
}

export default {
	name: "single-config",
	type: "configuration"
};
