/**
 * Math API module for testing slothlet loader.
 * @returns {object} rootMath API methods.
 * @example Math usage with slothlet loader
 * ```javascript
 * api.rootMath.add(2, 3); // 5
 * api.rootMath.multiply(2, 3); // 6
 * ```
 */
export const rootMath = {
	/**
	 * Adds two numbers.
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 * @example
	 * ```javascript
	 * api.rootMath.add(2, 3); // 5
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
	 * api.rootMath.multiply(2, 3); // 6
	 * ```
	 */
	multiply(a, b) {
		return a * b;
	}
};
