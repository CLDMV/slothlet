/**
 * @fileoverview Mixed export test for Rule 8 Pattern B - filename matches folder, exports mixed default+named.
 * This tests the auto-flattening logic for C10 condition (mixed exports in single-file folder).
 */

/**
 * Default function for mixed export test.
 * @param {string} message - Message to process
 * @returns {string} Processed message
 */
function mixedDefault(message) {
	return `Mixed default: ${message}`;
}

/**
 * Named function for mixed export test.
 * @param {string} value - Value to process
 * @returns {string} Processed value
 */
export function mixedNamed(value) {
	return `Mixed named: ${value}`;
}

/**
 * Another named function for mixed export test.
 * @param {number} num - Number to process
 * @returns {number} Processed number
 */
export function mixedAnother(num) {
	return num * 2;
}

export default mixedDefault;
