/**
 * String API module for testing slothlet loader (single-file flattening).
 * @returns {object} string API methods.
 * @example String usage with slothlet loader
 * ```javascript
 * api.string.upper('abc'); // 'ABC'
 * api.string.reverse('abc'); // 'cba'
 * ```
 */
export const string = {
	/**
	 * Converts a string to uppercase.
	 * @param {string} str
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.string.upper('abc'); // 'ABC'
	 * ```
	 */
	upper(str) {
		return str.toUpperCase();
	},
	/**
	 * Reverses a string.
	 * @param {string} str
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.string.reverse('abc'); // 'cba'
	 * ```
	 */
	reverse(str) {
		return str.split("").reverse().join("");
	}
};
