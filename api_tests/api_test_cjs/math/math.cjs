/**
 * @fileoverview Math API module (CJS version) for testing slothlet loader with auto-flattening behavior. Internal file (not exported in package.json).
 * @module api_test_cjs.math
 * @memberof module:api_test_cjs
 */

let _;
(async () => {
	({ self: _, context: _, reference: _ } = await import("@cldmv/slothlet/runtime"));
})();

/**
 * Math API object with basic arithmetic operations for testing auto-flattening (CJS version).
 * This module tests slothlet's ability to flatten single-file folder structures.
 * Accessed as `api.math` in the slothlet API.
 * @alias module:api_test_cjs.math
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.math.add(2, 3)); // 5
 * console.log(api_test_cjs.math.multiply(2, 3)); // 6
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs.math.add(2, 3)); // 5
 *   console.log(api_test_cjs.math.multiply(2, 3)); // 6
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs.math.add(2, 3)); // 5
 *   console.log(api_test_cjs.math.multiply(2, 3)); // 6
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.math.add(2, 3)); // 5
 * console.log(api_test_cjs.math.multiply(2, 3)); // 6
 */
const math =
	/** @lends math */
	{
		/**
		 * Adds two numbers.
		 * @function add
		 * @public
		 * @param {number} a - First number to add.
		 * @param {number} b - Second number to add.
		 * @returns {number} The sum of a and b.
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 * console.log(api_test_cjs.math.add(2, 3)); // 5
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 *   console.log(api_test_cjs.math.add(2, 3)); // 5
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 *   console.log(api_test_cjs.math.add(2, 3)); // 5
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 * console.log(api_test_cjs.math.add(2, 3)); // 5
		 */
		add(a, b) {
			return a + b;
		},
		/**
		 * Multiplies two numbers.
		 * @function multiply
		 * @public
		 * @param {number} a - First number to multiply.
		 * @param {number} b - Second number to multiply.
		 * @returns {number} The product of a and b.
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 * console.log(api_test_cjs.math.multiply(2, 3)); // 6
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 *   console.log(api_test_cjs.math.multiply(2, 3)); // 6
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 *   console.log(api_test_cjs.math.multiply(2, 3)); // 6
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 * console.log(api_test_cjs.math.multiply(2, 3)); // 6
		 */
		multiply(a, b) {
			return a * b;
		}
	};

module.exports = math;
