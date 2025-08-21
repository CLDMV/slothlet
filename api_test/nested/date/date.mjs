/**
 * Date API module for testing slothlet loader nested loading.
 * @returns {object} Date API methods.
 * @example
 * import api from './api_test';
 * api.nested.date.today(); // '2025-08-15'
 */
export default {
	/**
	 * Returns today's date as YYYY-MM-DD.
	 * @returns {string}
	 * @example
	 * today(); // '2025-08-15'
	 */
	today() {
		return "2025-08-15";
	}
};
