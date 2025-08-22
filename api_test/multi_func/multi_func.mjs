/**
 * multi_func.mjs - Test file for folder flattening in slothlet
 * Exports unique functions to be flattened onto the multi_func API object.
 *
 * Usage:
 *   api.multiFunc.uniqueOne(...)
 *   api.multiFunc.uniqueTwo(...)
 *   api.multiFunc.uniqueThree(...)
 */

export function uniqueOne(msg) {
	return `uniqueOne: ${msg}`;
}

export function uniqueTwo(msg) {
	return `uniqueTwo: ${msg}`;
}

export function uniqueThree(msg) {
	return `uniqueThree: ${msg}`;
}

export const multi_func = {
	/**
	 * Returns a test string.
	 * @returns {string}
	 * @example
	 * ```javascript
	 * api.multi_func.multi_func_hello(); // 'beta hello'
	 * ```
	 */
	multi_func_hello() {
		return "beta hello";
	}
};
