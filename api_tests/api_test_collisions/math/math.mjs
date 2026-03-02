/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/math/math.mjs
 *	@Date: 2026-01-23T08:17:46-08:00 (1769185066)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:13 -08:00 (1772425273)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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

