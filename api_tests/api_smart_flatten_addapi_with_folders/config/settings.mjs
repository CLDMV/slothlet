/**
 * Plugin config file in config subfolder.
 * Should appear as api.plugins.config.{functions} (NOT flattened)
 */

export function getPluginConfig() {
	return "plugin-config-data";
}

export function setPluginConfig(value) {
	return `plugin-config-set-${value}`;
}

export const configDefaults = {
	enabled: true,
	timeout: 5000
};
