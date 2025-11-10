/**
 * @fileoverview Function name preference test for parseJSON.
 * Tests Rule 9 - Function Name Preference Over Sanitization.
 * File: parse-json.mjs, Function: parseJSON (preserves JSON capitalization)
 */

/**
 * Parses JSON string with error handling.
 * @param {string} jsonString - JSON string to parse
 * @returns {Object|null} Parsed object or null if invalid
 * @example
 * api.task.parseJSON('{"key": "value"}'); // → {key: "value"}
 */
function parseJSON(jsonString) {
	try {
		return JSON.parse(jsonString);
	} catch (error) {
		console.error("Invalid JSON:", error.message);
		return null;
	}
}

// Named export to test function name preference
export { parseJSON };
