/**
 * @fileoverview Filename to API property name transformation
 * @module @cldmv/slothlet/helpers/sanitize
 */

/**
 * Convert filename to API property name
 * @param {string} filename - Original filename (without extension)
 * @returns {string} Sanitized property name
 * @public
 * @example
 * sanitizePropertyName("root-math") // "rootMath"
 * sanitizePropertyName("auto-ip") // "autoIp"
 * sanitizePropertyName("my_module") // "myModule"
 */
export function sanitizePropertyName(filename) {
	if (!filename || typeof filename !== "string") {
		return filename;
	}

	// Remove leading/trailing whitespace and special chars
	let name = filename.trim();

	// Replace hyphens and underscores with camelCase
	name = name.replace(/[-_]([a-z])/g, (_, char) => char.toUpperCase());

	// Remove any remaining invalid characters
	name = name.replace(/[^a-zA-Z0-9_$]/g, "");

	// Ensure doesn't start with number
	if (/^[0-9]/.test(name)) {
		name = "_" + name;
	}

	return name;
}

/**
 * Get module ID from file path
 * @param {string} filePath - Full file path
 * @param {string} baseDir - Base directory
 * @returns {string} Module ID
 * @public
 */
export function getModuleId(filePath, baseDir) {
	// Remove base directory and extension
	let relative = filePath.replace(baseDir, "").replace(/\\/g, "/");
	relative = relative.replace(/^\//, ""); // Remove leading slash
	relative = relative.replace(/\.(mjs|cjs|js)$/, ""); // Remove extension

	return relative;
}

/**
 * Check if filename represents a special function name that should preserve case
 * @param {string} name - Name to check
 * @returns {boolean} True if special case should be preserved
 * @private
 */
export function shouldPreserveFunctionCase(name) {
	const preservePatterns = [
		/^[A-Z]{2,}$/, // All caps (IP, HTTP, API, JSON, etc.)
		/[A-Z]{2,}/ // Contains multiple consecutive caps
	];

	return preservePatterns.some((pattern) => pattern.test(name));
}
