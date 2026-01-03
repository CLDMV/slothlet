/**
 * Set configuration value in module-specific namespace ONLY
 *
 * SECURITY RESTRICTIONS:
 *   - core:* namespace: READ ONLY - Cannot be written (throws error)
 *   - public:* namespace: READ ONLY - Cannot be written (throws error)
 *   - module:{name}:* namespace: Writable by that module only
 *
 * @param {string} key - Configuration key with namespace prefix (must be module:name:KEY)
 * @param {*} value - Value to set
 * @throws {Error} If attempting to write to core: or public:, access denied, or config not loaded
 *
 * @example
 * // Module can set its own config
 * set("module:tasks:API_KEY", "new-key-123")  // ✅ @asbuilt/tasks only
 * set("module:tasks:CACHE_TTL", 3600)         // ✅ @asbuilt/tasks only
 *
 * @example
 * // Attempting to write to restricted namespaces fails
 * set("core:DATABASE_URL", "...")   // ❌ Throws error - core: is read-only
 * set("public:PORT", 8080)          // ❌ Throws error - public: is read-only
 */
export default function set(key, value) {
	if (!configAccessor) {
		throw new Error("Config API not initialized. Module init lifecycle must call initializeConfigAPI()");
	}

	// Delegate to injected config accessor
	// Security checks happen in lib/config.mjs
	return configAccessor.setConfigValue(key, value);
}

// Note: This would need access to configAccessor from initializeConfigAPI
// In a real module system, this would be shared state or imported
let configAccessor = null;
