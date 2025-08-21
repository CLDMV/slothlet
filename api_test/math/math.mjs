/**
 * Math API module for testing slothlet loader (single-file flattening).
 * @returns {object} Math API methods.
 * @example
 * import api from './api_test';
 * api.math.add(2, 3); // 5
 */
export default {
	/**
	 * Adds two numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 * @example
	 * add(2, 3); // 5
	 */
	add(a, b) {
		return a + b;
	},
	/**
	 * Multiplies two numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 * @example
	 * multiply(2, 3); // 6
	 */
	multiply(a, b) {
		return a * b;
	}
};
