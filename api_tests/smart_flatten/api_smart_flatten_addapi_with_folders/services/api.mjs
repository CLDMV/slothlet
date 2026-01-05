/**
 * Plugin API services file.
 * Should appear as api.plugins.services.{functions} (NOT flattened)
 */

export function getPluginApiService() {
	return "plugin-api-service";
}

export function pluginApiMethod(action) {
	return `plugin-api-${action}`;
}
