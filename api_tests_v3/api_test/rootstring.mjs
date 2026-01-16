/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/rootstring.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 08:12:13 -07:00 (1761145933)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root-level string API module for testing slothlet loader. Internal file (not exported in package.json).
 * @module api_test.rootstring
 * @memberof module:api_test
 */

/**
 * String manipulation API object with common string operations.
 * Provides uppercase and reverse functions for testing string operations in slothlet.
 * Accessed as `api.rootstring` in the slothlet API.
 * @alias module:api_test.rootstring
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.rootstring.upper("abc")); // 'ABC'
 * console.log(api_test.rootstring.reverse("abc")); // 'cba'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.rootstring.upper("abc")); // 'ABC'
 *   console.log(api_test.rootstring.reverse("abc")); // 'cba'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.rootstring.upper("abc")); // 'ABC'
 *   console.log(api_test.rootstring.reverse("abc")); // 'cba'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.rootstring.upper("abc")); // 'ABC'
 * console.log(api_test.rootstring.reverse("abc")); // 'cba'
 */
export const rootstring =
	/** @lends rootstring */
	{
		/**
		 * Converts a string to uppercase.
		 * @function upper
		 * @public
		 * @param {string} str - String to convert to uppercase
		 * @returns {string} The uppercased string
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.rootstring.upper("hello")); // 'HELLO'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.rootstring.upper("hello")); // 'HELLO'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.rootstring.upper("hello")); // 'HELLO'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.rootstring.upper("hello")); // 'HELLO'
		 */
		upper(str) {
			return str.toUpperCase();
		},

		/**
		 * Reverses a string character by character.
		 * @function reverse
		 * @public
		 * @param {string} str - String to reverse
		 * @returns {string} The reversed string
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.rootstring.reverse("hello")); // 'olleh'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.rootstring.reverse("hello")); // 'olleh'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.rootstring.reverse("hello")); // 'olleh'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.rootstring.reverse("hello")); // 'olleh'
		 */
		reverse(str) {
			return str.split("").reverse().join("");
		}
	};
