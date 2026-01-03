/**
 * Initialize config API with accessor functions from bootstrap
 * SECURITY: Only callable by module init lifecycle (trusted code)
 * @param {function} getConfigValueFn - Function to get config values
 * @param {function} setConfigValueFn - Function to set config values (module: namespace only)
 * @param {function} isConfigLoadedFn - Function to check if config loaded
 */
export default function initializeConfigAPI(getConfigValueFn, setConfigValueFn, isConfigLoadedFn) {
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
 * Injected config accessor functions (set during init lifecycle)
 * @type {Object|null}
 */
let configAccessor = null;
