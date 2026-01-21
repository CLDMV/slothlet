/**
 * @fileoverview Pattern C test - single file in folder where object name doesn't match filename.
 * File: singletest/helper.mjs, Object: utilities (object name ≠ filename)
 */

/**
 * Utilities object with mismatched name for Pattern C testing.
 * @type {Object}
 */
export const utilities = {
	/**
	 * Format a string.
	 * @param {string} input - Input string
	 * @returns {string} Formatted string
	 */
	format(input) {
		return `Formatted: ${input}`;
	},

	/**
	 * Parse a value.
	 * @param {string} value - Value to parse
	 * @returns {string} Parsed value
	 */
	parse(value) {
		return `Parsed: ${value}`;
	}
};
