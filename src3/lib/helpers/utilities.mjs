/**
 * @fileoverview General utility functions
 * @module @cldmv/slothlet/helpers/utilities
 */

/**
 * Check if value is a plain object
 * @param {*} obj - Value to check
 * @returns {boolean} True if plain object
 * @public
 */
export function isPlainObject(obj) {
	if (typeof obj !== "object" || obj === null) return false;
	const proto = Object.getPrototypeOf(obj);
	return proto === null || proto === Object.prototype;
}

/**
 * Deep merge objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 * @public
 */
export function deepMerge(target, source) {
	if (!isPlainObject(target) || !isPlainObject(source)) {
		return source;
	}

	const result = { ...target };

	for (const key in source) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			if (isPlainObject(source[key]) && isPlainObject(target[key])) {
				result[key] = deepMerge(target[key], source[key]);
			} else {
				result[key] = source[key];
			}
		}
	}

	return result;
}

/**
 * Generate unique ID
 * @returns {string} Unique identifier
 * @public
 */
export function generateId() {
	return `slothlet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if path is absolute
 * @param {string} path - Path to check
 * @returns {boolean} True if absolute path
 * @public
 */
export function isAbsolutePath(path) {
	if (typeof path !== "string") return false;
	// Windows: C:\ or \\
	// Unix: /
	return /^([a-zA-Z]:\\|\\\\|\/)/i.test(path);
}

/**
 * Decide whether a named export should be attached to a callable default export.
 * @param {string} key - Named export key.
 * @param {unknown} value - Named export value.
 * @param {Function} defaultFunc - Wrapped callable default export.
 * @param {Function} originalDefault - Original default export.
 * @returns {boolean} True if the export should be attached.
 * @public
 */
export function shouldAttachNamedExport(key, value, defaultFunc, originalDefault) {
	if (!key || key === "default") {
		return false;
	}
	if (value === defaultFunc || value === originalDefault) {
		return false;
	}
	if (typeof defaultFunc === "function" && key === defaultFunc.name) {
		return false;
	}
	if (typeof originalDefault === "function" && key === originalDefault.name) {
		return false;
	}
	return true;
}
