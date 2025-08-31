/**
 * @fileoverview Alpha object for testing nest2 deeply nested module structures. Internal file (not exported in package.json).
 * @module api_test.advanced.nest2.alpha
 * @memberof module:api_test
 */

/**
 * Alpha object for nest2 nested module loading test.
 * Accessed as `api.advanced.nest2.alpha` in the slothlet API.
 * @alias module:api_test.advanced.nest2.alpha
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
 */
export const alpha =
	/** @lends alpha */
	{
		/**
		 * Returns a test string.
		 * @function hello
		 * @public
		 * @returns {string} The string 'alpha hello'.
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.advanced.nest2.alpha.hello()); // 'alpha hello'
		 */
		hello() {
			return "alpha hello";
		}
	};
