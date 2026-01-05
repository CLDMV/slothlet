import set from "./set.mjs";

/**
 * Set module-specific configuration value (convenience wrapper)
 * Only writable by the specified module
 *
 * @param {string} moduleName - Module name (e.g., "tasks", "billing")
 * @param {string} key - Configuration key
 * @param {*} value - Value to set
 * @throws {Error} If access denied or config not loaded
 *
 * @example
 * setModule("tasks", "API_KEY", "new-key-123")  // Same as set("module:tasks:API_KEY", "new-key-123")
 * setModule("tasks", "CACHE_TTL", 3600)         // Same as set("module:tasks:CACHE_TTL", 3600)
 */
export default function setModule(moduleName, key, value) {
	// Security check happens in lib/config.mjs via stack trace
	return set(`module:${moduleName}:${key}`, value);
}
