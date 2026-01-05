import get from "./get.mjs";

/**
 * Get module-specific configuration value (convenience wrapper)
 * Only accessible by the specified module
 *
 * @param {string} moduleName - Module name (e.g., "tasks", "billing")
 * @param {string} key - Configuration key
 * @param {*} [defaultValue] - Default value if key not found
 * @returns {*} Configuration value
 * @throws {Error} If access denied or config not loaded
 *
 * @example
 * getModule("tasks", "API_KEY")  // Same as get("module:tasks:API_KEY")
 * getModule("billing", "STRIPE_KEY")  // Same as get("module:billing:STRIPE_KEY")
 */
export default function getModule(moduleName, key, defaultValue = undefined) {
	// Security check happens in lib/config.mjs via stack trace
	return get(`module:${moduleName}:${key}`, defaultValue);
}
