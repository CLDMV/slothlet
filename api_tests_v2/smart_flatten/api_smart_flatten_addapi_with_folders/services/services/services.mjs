/**
 * Services file in deeply nested services/services/ folder.
 * Tests that even with addapi.mjs flattening, deep nesting preserves structure.
 * Should appear as api.plugins.services.services.{functions} (NOT flattened recursively)
 */

export function getNestedPluginService() {
	return "deeply-nested-plugin-service";
}

export function processPluginData(data) {
	return `plugin-processed-${data}`;
}
