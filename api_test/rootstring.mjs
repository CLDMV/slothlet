/**
 * String API module for testing slothlet loader.
 * @returns {object} rootstring API methods.
 * @example String usage with slothlet loader
 * ```javascript
 * api.rootstring.upper('abc'); // 'ABC'
 * api.rootstring.reverse('abc'); // 'cba'
 * ```
 */
export const rootstring = {
	/**
	 * Converts a string to uppercase.
	 * @param {string} str
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.rootstring.upper('abc'); // 'ABC'
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
	 * api.rootstring.reverse('abc'); // 'cba'
	 * ```
	 */
	reverse(str) {
		return str.split("").reverse().join("");
	}
};
