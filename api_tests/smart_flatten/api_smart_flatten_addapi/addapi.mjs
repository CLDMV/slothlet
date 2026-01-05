/**
 * Test folder for smart flattening Case 2: Special addapi.mjs file
 * Scenario: addApi("plugins", "./addapi-folder") where folder contains addapi.mjs
 * Expected: api.plugins.{functions} (not api.plugins.addapi.{functions})
 */

export function initializePlugin() {
	return "Plugin initialized";
}

export function pluginMethod() {
	return "Plugin method called";
}

export function cleanup() {
	return "Plugin cleaned up";
}

export default {
	special: "addapi-file",
	autoFlatten: true
};
