/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/advanced/nest2/beta.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:16:57 -08:00 (1772425017)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Beta object for testing nest2 deeply nested module structures. Internal file (not exported in package.json).
 * @module api_test.advanced.nest2.beta
 * @memberof module:api_test
 */
export const beta =
	/** @lends beta */
	{
		/**
	* Returns a test string.
	* @function world
	* @public
	* @returns {string} The string 'beta world'.
	* @example // ESM usage via slothlet API
	* import slothlet from "@cldmv/slothlet";
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
	*
	* @example // ESM usage via slothlet API (inside async function)
	* async function example() {
	*   const { default: slothlet } = await import("@cldmv/slothlet");
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
	* }
	*
	* @example // CJS usage via slothlet API (top-level)
	* let slothlet;
	* (async () => {
	*   ({ slothlet } = await import("@cldmv/slothlet"));
	*   const api_test = await slothlet({ dir: './api_tests/api_test' });
	*   console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
	* })();
	*
	* @example // CJS usage via slothlet API (inside async function)
	* const slothlet = require("@cldmv/slothlet");
	* const api_test = await slothlet({ dir: './api_tests/api_test' });
	* console.log(api_test.advanced.nest2.beta.world()); // 'beta world'
	*/
		world() {
			return "beta world";
		}
	};

