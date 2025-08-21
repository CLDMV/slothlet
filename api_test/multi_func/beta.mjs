/**
 * Beta module for multi-file API loader test (exports an object with methods).
 * @returns {object} beta API methods.
 * @example Beta object usage
 * ```javascript
 * api.multi_func.beta.hello(); // 'beta hello'
 * ```
 */
export const beta = {
	/**
	 * Returns a test string.
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.multi_func.beta.hello(); // 'beta hello'
	 * ```
	 */
	hello() {
		return "beta hello";
	}
};
