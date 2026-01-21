/**
 * @fileoverview Math API module for testing slothlet loader with auto-flattening behavior. Internal file (not exported in package.json).
 * @module api_test.math
 * @memberof module:api_test
 */

// Runtime imports (unused but required for API structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Math API object with basic arithmetic operations for testing auto-flattening.
 * This module tests slothlet's ability to flatten single-file folder structures.
 * Accessed as `api.math` in the slothlet API.
 * @alias module:api_test.math
 * @public
 * @property {Function} add - Adds two numbers
 * @property {Function} multiply - Multiplies two numbers
 * @property {Function} divide - Divides two numbers
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.math.add(2, 3)); // 5
 * console.log(api_test.math.multiply(2, 3)); // 6
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.math.add(2, 3)); // 5
 *   console.log(api_test.math.multiply(2, 3)); // 6
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.math.add(2, 3)); // 5
 *   console.log(api_test.math.multiply(2, 3)); // 6
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.math.add(2, 3)); // 5
 * console.log(api_test.math.multiply(2, 3)); // 6
 */
export const math =
	/** @lends math */
	{
		/**
		 * Adds two numbers together.
		 * @function add
		 * @public
		 * @param {number} a - First number to add
		 * @param {number} b - Second number to add
		 * @returns {number} The sum of a and b
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.math.add(5, 7)); // 12
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.math.add(5, 7)); // 12
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.math.add(5, 7)); // 12
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.math.add(5, 7)); // 12
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
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.math.multiply(4, 6)); // 24
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.math.multiply(4, 6)); // 24
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.math.multiply(4, 6)); // 24
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.math.multiply(4, 6)); // 24
		 */
		multiply(a, b) {
			return a * b;
		},
		/**
		 * Divides two numbers.
		 * @function divide
		 * @public
		 * @param {number} a - Numerator
		 * @param {number} b - Denominator
		 * @returns {number} The quotient of a divided by b
		 * @throws {Error} If denominator is zero
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.math.divide(10, 2)); // 5
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.math.divide(10, 2)); // 5
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.math.divide(10, 2)); // 5
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.math.divide(10, 2)); // 5
		 */
		divide(a, b) {
			if (b === 0) {
				throw new Error("Cannot divide by zero");
			}
			return a / b;
		}
	};
