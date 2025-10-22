/**
 * @fileoverview Multi-function module for testing folder flattening behavior. Internal file (not exported in package.json).
 * @module api_test.multi_func
 * @memberof module:api_test
 */

/**
 * Test file for folder flattening in slothlet.
 * Exports unique functions to be flattened onto the multi_func API object.
 * Functions are accessed as `api.multi_func.uniqueOne()`, etc. in the slothlet API.
 */

/**
 * Returns a uniqueOne message.
 * Accessed as `api.multiFunc.uniqueOne()` in the slothlet API.
 * @function uniqueOne
 * @public
 * @param {string} msg - Message to include.
 * @returns {string} Formatted message with uniqueOne prefix.
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.multiFunc.uniqueOne("test")); // 'uniqueOne: test'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.multiFunc.uniqueOne("test")); // 'uniqueOne: test'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.multiFunc.uniqueOne("test")); // 'uniqueOne: test'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.multiFunc.uniqueOne("test")); // 'uniqueOne: test'
 */
export function uniqueOne(msg) {
	return `uniqueOne: ${msg}`;
}

/**
 * Returns a uniqueTwo message.
 * Accessed as `api.multiFunc.uniqueTwo()` in the slothlet API.
 * @function uniqueTwo
 * @public
 * @param {string} msg - Message to include.
 * @returns {string} Formatted message with uniqueTwo prefix.
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.multiFunc.uniqueTwo("test")); // 'uniqueTwo: test'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.multiFunc.uniqueTwo("test")); // 'uniqueTwo: test'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.multiFunc.uniqueTwo("test")); // 'uniqueTwo: test'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.multiFunc.uniqueTwo("test")); // 'uniqueTwo: test'
 */
export function uniqueTwo(msg) {
	return `uniqueTwo: ${msg}`;
}

/**
 * Returns a uniqueThree message.
 * Accessed as `api.multiFunc.uniqueThree()` in the slothlet API.
 * @function uniqueThree
 * @public
 * @param {string} msg - Message to include.
 * @returns {string} Formatted message with uniqueThree prefix.
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.multiFunc.uniqueThree("test")); // 'uniqueThree: test'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.multiFunc.uniqueThree("test")); // 'uniqueThree: test'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.multiFunc.uniqueThree("test")); // 'uniqueThree: test'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.multiFunc.uniqueThree("test")); // 'uniqueThree: test'
 */
export function uniqueThree(msg) {
	return `uniqueThree: ${msg}`;
}

/**
 * Multi-function object with test methods.
 * @alias module:api_test.multi_func
 * @public
 */
export const multi_func =
	/** @lends multi_func */
	{
		/**
		 * Returns a test string.
		 * @function multi_func_hello
		 * @public
		 * @returns {string} The string "beta hello"
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.multi_func.multi_func_hello()); // 'beta hello'
		 */
		multi_func_hello() {
			return "beta hello";
		}
	};
