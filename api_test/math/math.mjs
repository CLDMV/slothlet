/**
 * Math API module for testing slothlet loader (single-file flattening).
 * @returns {object} math API methods.
 * @example Math usage with slothlet loader
 * ```javascript
 * api.math.add(2, 3); // 5
 * api.math.multiply(2, 3); // 6
 * ```
 */
export const math = {
	/**
	 * Adds two numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 * @example
	 * ```javascript
	 * api.math.add(2, 3); // 5
	 * ```
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
	 * ```javascript
	 * api.math.multiply(2, 3); // 6
	 * ```
	 */
	multiply(a, b) {
		return a * b;
	}
};
