/**
 * @fileoverview Root-level math API module for testing slothlet loader. Internal file (not exported in package.json).
 * @module api_test.rootMath
 * @memberof module:api_test
 */

/**
 * Math API object with basic arithmetic operations.
 * Provides add and multiply functions for testing mathematical operations in slothlet.
 * Accessed as `api.rootMath` in the slothlet API.
 * @alias module:api_test.rootMath
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.rootMath.add(2, 3)); // 5
 * console.log(api_test.rootMath.multiply(2, 3)); // 6
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.rootMath.add(2, 3)); // 5
 *   console.log(api_test.rootMath.multiply(2, 3)); // 6
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.rootMath.add(2, 3)); // 5
 *   console.log(api_test.rootMath.multiply(2, 3)); // 6
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.rootMath.add(2, 3)); // 5
 * console.log(api_test.rootMath.multiply(2, 3)); // 6
 */
export const rootMath =
	/** @lends rootMath */
	{
		/**
		 * Adds two numbers together.
		 * @function add
		 * @public
		 * @param {number} a - First number to add
		 * @param {number} b - Second number to add
		 * @returns {number} The sum of a and b
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.rootMath.add(5, 7)); // 12
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.rootMath.add(5, 7)); // 12
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.rootMath.add(5, 7)); // 12
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.rootMath.add(5, 7)); // 12
		 */
		add(a, b) {
			return a + b;
		},

		/**
		 * Multiplies two numbers together.
		 * @function multiply
		 * @public
		 * @param {number} a - First number to multiply
		 * @param {number} b - Second number to multiply
		 * @returns {number} The product of a and b
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.rootMath.multiply(4, 6)); // 24
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.rootMath.multiply(4, 6)); // 24
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.rootMath.multiply(4, 6)); // 24
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.rootMath.multiply(4, 6)); // 24
		 */
		multiply(a, b) {
			return a * b;
		}
	};
