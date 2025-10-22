/**
 * @fileoverview CJS math operations for slothlet mixed API testing.
 * @module api_test_mixed.mathCjs
 * @memberof module:api_test_mixed
 */

/**
 * Math operations object accessed as `api.mathCjs`.
 * @alias module:api_test_mixed.mathCjs
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 *   console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 *   console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
 */
const mathCjs =
	/** @lends mathCjs */
	{
		/**
		 * Multiplies two numbers with CJS live binding testing.
		 * @function multiply
		 * @public
		 * @async
		 * @param {number} a - First number to multiply.
		 * @param {number} b - Second number to multiply.
		 * @returns {Promise<number>} The product of a and b.
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(await api_test_mixed.mathCjs.multiply(2, 3)); // 6
		 */
		async multiply(a, b) {
			console.log(`CJS Math: Multiplying ${a} * ${b}`);

			// Get live bindings from runtime
			const { context } = await import("@cldmv/slothlet/runtime");

			console.log(`CJS Context: User=${context.user}, Instance=${context.instanceName}`);

			return a * b;
		},
		/**
		 * Divides two numbers with CJS live binding testing.
		 * @function divide
		 * @public
		 * @async
		 * @param {number} a - Number to divide.
		 * @param {number} b - Number to divide by.
		 * @returns {Promise<number>} The quotient of a and b.
		 * @throws {Error} When dividing by zero.
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(await api_test_mixed.mathCjs.divide(10, 2)); // 5
		 */
		async divide(a, b) {
			console.log(`CJS Math: Dividing ${a} / ${b}`);

			// Get live bindings from runtime
			const { context } = await import("@cldmv/slothlet/runtime");

			console.log(`CJS Context: User=${context.user}, Instance=${context.instanceName}`);

			if (b === 0) throw new Error("Division by zero");
			return a / b;
		}
	};

module.exports = mathCjs;
