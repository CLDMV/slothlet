/**
 * String API module for testing slothlet loader.
 * @returns {object} String API methods.
 * @example
 * import api from './api_test';
 * api.string.upper('abc'); // 'ABC'
 */
export default {
	/**
	 * Converts a string to uppercase.
	 * @param {string} str
	 * @returns {string}
	 * @example
	 * upper('abc'); // 'ABC'
	 */
	upper(str) {
		return str.toUpperCase();
	},
	/**
	 * Reverses a string.
	 * @param {string} str
	 * @returns {string}
	 * @example
	 * reverse('abc'); // 'cba'
	 */
	reverse(str) {
		return str.split("").reverse().join("");
	}
};
