/**
 * Get configuration value by key with namespace-based access control
 *
 * SECURITY:
 *   - public:* keys: Anyone can access
 *   - core:* keys: Only @asbuilt/* packages (verified by lib/config.mjs)
 *   - module:{name}:* keys: Only that specific module (verified by lib/config.mjs)
 *
 * @param {string} key - Configuration key with namespace prefix (public:KEY, core:KEY, module:name:KEY)
 * @param {*} [defaultValue] - Default value if key not found
 * @returns {*} Configuration value
 * @throws {Error} If access denied, config not loaded, or invalid key format
 *
 * @example
 * // Public config (all modules)
 * get("public:NODE_ENV")
 * get("public:PORT")
 * get("public:APP_URL")
 *
 * @example
 * // Core config (@asbuilt/* only)
 * get("core:DATABASE_URL")
 * get("core:JWT_SECRET")
 * get("core:REDIS_URL")
 *
 * @example
 * // Module-specific config (that module only)
 * get("module:tasks:API_KEY")
 * get("module:billing:STRIPE_KEY")
 */
export default function get(key, defaultValue = undefined) {
	if (!configAccessor) {
		throw new Error("Config API not initialized. Module init lifecycle must call initializeConfigAPI()");
	}

	// Delegate to injected config accessor
	// Stack trace verification happens in lib/config.mjs
	return configAccessor.getConfigValue(key, defaultValue);
}

// Note: This would need access to configAccessor from initializeConfigAPI
// In a real module system, this would be shared state or imported
let configAccessor = null;
