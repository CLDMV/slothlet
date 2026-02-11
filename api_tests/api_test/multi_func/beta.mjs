/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/multi_func/beta.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:02:01 -08:00 (1770775321)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

export const beta =
	/** @lends beta */
	{
		/**
	* Returns a test string.
	* @function hello
	* @public
	* @returns {string} The string "beta hello".
	* @example // ESM usage via slothlet API
	* import slothlet from "@cldmv/slothlet";
	* const api_test = await slothlet({ dir: "./api_tests/api_test" });
	* console.log(api_test.multiFunc.beta.hello()); // "beta hello"
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: "./api_tests/api_test" });
	*   console.log(api_test.multiFunc.beta.hello()); // "beta hello"
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: "./api_tests/api_test" });
	*   console.log(api_test.multiFunc.beta.hello()); // "beta hello"
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: "./api_tests/api_test" });
	* console.log(api_test.multiFunc.beta.hello()); // "beta hello"
	*/
		hello() {
			return "beta hello";
		}
	};

