/**
 * Alpha module for multi-file API loader test.
 * @returns {object} alpha API methods.
 * @example Alpha object usage
 * ```javascript
 * api.multi.alpha.hello(); // 'alpha hello'
 * ```
 */
export const alpha = {
	/**
	 * Returns a test string.
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.multi.alpha.hello(); // 'alpha hello'
	 * ```
	 */
	hello() {
		return "alpha hello";
	}
};
