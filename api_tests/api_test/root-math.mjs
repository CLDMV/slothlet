/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/root-math.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 21:33:03 -07:00 (1773376383)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root-level math API module for testing slothlet loader. Internal file (not exported in package.json).
 * @module api_test.rootMath
 * @memberof module:api_test
 */
/**
 * @namespace rootMath
 * @memberof module:api_test
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
	* import slothlet from "@cldmv/slothlet";
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
	* import slothlet from "@cldmv/slothlet";
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

