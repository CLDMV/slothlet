/**
 * Config API - Public Configuration Access Module
 *
 * SECURITY ARCHITECTURE:
 *   This module receives config accessor functions from bootstrap via initialization.
 *   Functions are passed during module init lifecycle, avoiding hardcoded import paths.
 *
 * IMPORTANT:
 *   - Does NOT hold configuration data directly
 *   - Does NOT expose objects/classes (functions only)
 *   - Does NOT access process.env directly
 *   - All data access goes through injected functions from lib/config.mjs
 *
 * Namespaces:
 *   public:*        - All modules can access (NODE_ENV, APP_URL, PORT)
 *   core:*          - Only @asbuilt/* modules (DATABASE_URL, JWT_SECRET, AWS credentials)
 *   module:{name}:* - Only that specific module (module-specific API keys)
 */

/**
 * Injected config accessor functions (set during init lifecycle)
 * @type {Object|null}
 */
let configAccessor = null;

/**
 * Initialize config API with accessor functions from bootstrap
 * SECURITY: Only callable by module init lifecycle (trusted code)
 * @param {function} getConfigValueFn - Function to get config values
 * @param {function} setConfigValueFn - Function to set config values (module: namespace only)
 * @param {function} isConfigLoadedFn - Function to check if config loaded
 */
function initializeConfigAPI(getConfigValueFn, setConfigValueFn, isConfigLoadedFn) {
	if (configAccessor !== null) {
		// Already initialized, skip (called during module init)
		return;
	}

	configAccessor = {
		getConfigValue: getConfigValueFn,
		setConfigValue: setConfigValueFn,
		isConfigLoaded: isConfigLoadedFn
	};

	// Config API ready (logged by init lifecycle)
}

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
function get(key, defaultValue = undefined) {
	if (!configAccessor) {
		throw new Error("Config API not initialized. Module init lifecycle must call initializeConfigAPI()");
	}

	// Delegate to injected config accessor
	// Stack trace verification happens in lib/config.mjs
	return configAccessor.getConfigValue(key, defaultValue);
}

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
function set(key, value) {
	if (!configAccessor) {
		throw new Error("Config API not initialized. Module init lifecycle must call initializeConfigAPI()");
	}

	// Delegate to injected config accessor
	// Security checks happen in lib/config.mjs
	return configAccessor.setConfigValue(key, value);
}

/**
 * Check if configuration has been loaded
 * @returns {boolean} True if config is loaded
 */
function isLoaded() {
	if (!configAccessor) {
		return false;
	}
	return configAccessor.isConfigLoaded();
}

/**
 * Get public configuration value (convenience wrapper)
 * Only accesses public namespace, no privileged data
 *
 * @param {string} key - Configuration key (without public: prefix)
 * @param {*} [defaultValue] - Default value if key not found
 * @returns {*} Configuration value
 * @throws {Error} If config not loaded
 *
 * @example
 * getPublic("NODE_ENV")  // Same as get("public:NODE_ENV")
 * getPublic("PORT")      // Same as get("public:PORT")
 */
function getPublic(key, defaultValue = undefined) {
	return get(`public:${key}`, defaultValue);
}

/**
 * Get core configuration value (convenience wrapper)
 * Only accessible by @asbuilt/* packages
 *
 * @param {string} key - Configuration key (without core: prefix)
 * @param {*} [defaultValue] - Default value if key not found
 * @returns {*} Configuration value
 * @throws {Error} If access denied or config not loaded
 *
 * @example
 * getCore("DATABASE_URL")  // Same as get("core:DATABASE_URL")
 * getCore("JWT_SECRET")    // Same as get("core:JWT_SECRET")
 */
function getCore(key, defaultValue = undefined) {
	// Security check happens in lib/config.mjs via stack trace
	return get(`core:${key}`, defaultValue);
}

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
function getModule(moduleName, key, defaultValue = undefined) {
	// Security check happens in lib/config.mjs via stack trace
	return get(`module:${moduleName}:${key}`, defaultValue);
}

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
function setModule(moduleName, key, value) {
	// Security check happens in lib/config.mjs via stack trace
	return set(`module:${moduleName}:${key}`, value);
}

export default {
	setModule,
	getModule,
	getCore,
	getPublic,
	isLoaded,
	set,
	get,
	initializeConfigAPI
};
