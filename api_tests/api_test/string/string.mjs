/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/string/string.mjs
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
 * @fileoverview String API module for testing slothlet loader with auto-flattening behavior. Internal file (not exported in package.json).
 * @module api_test.string
 * @memberof module:api_test
 */
/**
 * @namespace string
 * @memberof module:api_test
 */

export const string =
	/** @lends string */
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
	* console.log(api_test.string.upper("World")); // 'WORLD'
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.string.upper("World")); // 'WORLD'
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.string.upper("World")); // 'WORLD'
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.string.upper("World")); // 'WORLD'
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
	* console.log(api_test.string.reverse("World")); // 'dlrow'
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.string.reverse("World")); // 'dlrow'
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.string.reverse("World")); // 'dlrow'
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.string.reverse("World")); // 'dlrow'
	*/
		reverse(str) {
			return str.split("").reverse().join("");
		}
	};

