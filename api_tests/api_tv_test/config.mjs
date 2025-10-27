/**
 * TV Config API - Simplified for slothlet testing
 */

export const config = {
	defaults: {
		manufacturer: "lg",
		host: "192.168.1.100",
		port: 3000
	},

	get(key) {
		return key ? this.defaults[key] : this.defaults;
	},

	update(keyOrConfig, value) {
		return { success: true, key: keyOrConfig, value };
	},

	set(key, value) {
		return { success: true, key, value };
	},

	getDefaultPort(_) {
		return 3000;
	},

	validate(config, _ = []) {
		return { isValid: true, missing: [], config };
	},

	merge(userConfig = {}, _ = "") {
		return { ...this.defaults, ...userConfig };
	},

	createManufacturerConfig(manufacturer, options = {}) {
		return { manufacturer, ...options };
	}
};

// Export config object as default (IMPORTANT: This creates self-referential export)
export default config;
