/**
 * @fileoverview Beta object for testing nest2 deeply nested module structures. Internal file (not exported in package.json).
 * @module api_test.advanced.nest2.beta
 * @memberof module:api_test
 */

/**
 * Beta object for nest2 nested module loading test.
 * Accessed as `api.advanced.nest2.beta` in the slothlet API.
 * @alias module:api_test.advanced.nest2.beta
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
 */
export const beta =
	/** @lends beta */
	{
		/**
		 * Returns a test string.
		 * @function world
		 * @public
		 * @returns {string} The string 'beta world'.
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
		 */
		world() {
			return "beta world";
		}
	};
