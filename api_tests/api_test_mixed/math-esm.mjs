/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_mixed/math-esm.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:14 -08:00 (1772425274)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

export const mathEsm =
	/** @lends mathEsm */
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
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 * 	({ slothlet } = await import("@cldmv/slothlet"));
		 * 	const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * 	console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(api_test_mixed.mathEsm.add(2, 3)); // 5
		 */
		add(a, b) {
			return a + b;
		},

		/**
		 * Subtracts two numbers.
		 * @function subtract
		 * @public
		 * @param {number} a - Number to subtract from.
		 * @param {number} b - Number to subtract.
		 * @returns {number} The difference of a and b.
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(api_test_mixed.mathEsm.subtract(5, 3)); // 2
		 */
		subtract(a, b) {
			return a - b;
		}
	};

