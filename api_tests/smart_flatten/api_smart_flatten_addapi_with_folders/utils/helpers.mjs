/**
 * Plugin utilities in utils subfolder.
 * Should appear as api.plugins.utils.{functions} (NOT flattened)
 */

export function formatPluginOutput(data) {
	return `[Plugin] ${data}`;
}

export function validatePluginInput(input) {
	return input && typeof input === "string" && input.length > 0;
}

export const utilityVersion = "1.0.0";
