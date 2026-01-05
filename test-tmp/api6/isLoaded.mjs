/**
 * Check if configuration has been loaded
 * @returns {boolean} True if config is loaded
 */
export default function isLoaded() {
	if (!configAccessor) {
		return false;
	}
	return configAccessor.isConfigLoaded();
}

// Note: This would need access to configAccessor from initializeConfigAPI
// In a real module system, this would be shared state or imported
let configAccessor = null;
