/**
 * Alpha module for multi-file API loader test.
 * @returns {object}
 * @example
 * import api from './api_test';
 * api.multi.alpha.hello(); // 'alpha hello'
 */
export default {
	/**
	 * Returns a test string.
	 * @returns {string}
	 * @example
	 * hello(); // 'alpha hello'
	 */
	hello() {
		return "alpha hello";
	}
};
