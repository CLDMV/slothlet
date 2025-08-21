/**
 * Date API module for testing slothlet loader nested loading.
 * @returns {object} date API methods.
 * @example Date usage with slothlet loader
 * ```javascript
 * api.nested.date.today(); // '2025-08-15'
 * ```
 */
export const date = {
	/**
	 * Returns today's date as YYYY-MM-DD.
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.nested.date.today(); // '2025-08-15'
	 * ```
	 */
	today() {
		return "2025-08-15";
	}
};
