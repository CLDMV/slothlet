/**
 * Defaults utility for loading and managing system defaults from JSON files.
 * Used internally by data system modules.
 * @module utils/defaults
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory for relative imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded defaults
let defaultsCache = null;

/**
 * Auto-scans and loads defaults from JSON files in data/defaults/ directory.
 * @returns {Object} Loaded defaults organized by data system
 */
function loadDefaultsFromFiles() {
	const defaultsDir = path.join(__dirname, "..", "..", "data", "defaults");
	const loadedDefaults = {};

	try {
		// Check if defaults directory exists
		if (!fs.existsSync(defaultsDir)) {
			console.warn("Defaults directory not found:", defaultsDir);
			return {};
		}

		// Read all JSON files in defaults directory
		const files = fs.readdirSync(defaultsDir);
		const jsonFiles = files.filter((file) => file.endsWith(".json"));

		for (const file of jsonFiles) {
			const filePath = path.join(defaultsDir, file);
			const dataSystemName = path.basename(file, ".json");

			try {
				const fileContent = fs.readFileSync(filePath, "utf8");
				const defaults = JSON.parse(fileContent);
				loadedDefaults[dataSystemName] = defaults;
			} catch (error) {
				console.error(`Error loading defaults from ${file}:`, error.message);
			}
		}

		return loadedDefaults;
	} catch (error) {
		console.error("Error scanning defaults directory:", error.message);
		return {};
	}
}

/**
 * Gets defaults for a specific data system.
 * @param {string} dataSystemName - Name of the data system (config, device, etc.)
 * @returns {Object} Defaults for the data system
 */
export function getDefaults(dataSystemName) {
	// Load defaults if not cached
	if (!defaultsCache) {
		defaultsCache = loadDefaultsFromFiles();
	}

	return defaultsCache[dataSystemName] || {};
}

/**
 * Gets all defaults organized by data system.
 * @returns {Object} All defaults
 */
export function getAllDefaults() {
	// Load defaults if not cached
	if (!defaultsCache) {
		defaultsCache = loadDefaultsFromFiles();
	}

	return { ...defaultsCache };
}

/**
 * Reloads defaults from files (clears cache).
 * @returns {Object} Reloaded defaults
 */
export function reloadDefaults() {
	defaultsCache = null;
	return getAllDefaults();
}

/**
 * Creates a defaults API object for a specific data system.
 * @param {string} dataSystemName - Name of the data system
 * @param {Function} getCurrentValues - Function to get current values from the system
 * @param {Function} setValues - Function to set values in the system
 * @returns {Object} Defaults API for the data system
 */
export function createDefaultsAPI(dataSystemName, getCurrentValues, setValues) {
	const systemDefaults = getDefaults(dataSystemName);

	return {
		// Get all defaults for this system
		...systemDefaults,

		/**
		 * Restores specific keys to their default values.
		 * @param {string|string[]} keys - Key(s) to restore
		 * @returns {Object} The restored values
		 */
		restore(keys) {
			const keysArray = Array.isArray(keys) ? keys : [keys];
			const restored = {};

			keysArray.forEach((key) => {
				if (systemDefaults.hasOwnProperty(key)) {
					restored[key] = systemDefaults[key];
				}
			});

			// Apply the restored values
			if (Object.keys(restored).length > 0 && setValues) {
				setValues(restored);
			}

			return restored;
		},

		/**
		 * Checks if a value is at its default.
		 * @param {string} key - Key to check
		 * @returns {boolean} True if at default value
		 */
		isDefault(key) {
			if (!systemDefaults.hasOwnProperty(key)) {
				return false;
			}

			const currentValues = getCurrentValues ? getCurrentValues() : {};
			return currentValues[key] === systemDefaults[key];
		},

		/**
		 * Gets all keys that have been customized (not at default).
		 * @returns {Object} Object with customized keys and their current vs default values
		 */
		customized() {
			const currentValues = getCurrentValues ? getCurrentValues() : {};
			const customized = {};

			Object.keys(systemDefaults).forEach((key) => {
				if (currentValues[key] !== systemDefaults[key]) {
					customized[key] = {
						current: currentValues[key],
						default: systemDefaults[key]
					};
				}
			});

			return customized;
		},

		/**
		 * Resets all values to defaults.
		 * @param {string[]} [exclude] - Keys to exclude from reset
		 * @returns {Object} The reset values
		 */
		resetAll(exclude = []) {
			const resetValues = {};

			Object.keys(systemDefaults).forEach((key) => {
				if (!exclude.includes(key)) {
					resetValues[key] = systemDefaults[key];
				}
			});

			// Apply the reset values
			if (Object.keys(resetValues).length > 0 && setValues) {
				setValues(resetValues);
			}

			return resetValues;
		}
	};
}

export default {
	getDefaults,
	getAllDefaults,
	reloadDefaults,
	createDefaultsAPI
};
