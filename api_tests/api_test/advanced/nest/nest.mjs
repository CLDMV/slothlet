/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/advanced/nest/nest.mjs
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
 * @fileoverview Nested alpha function for testing deeply nested module structures. Internal file (not exported in package.json).
 * @module api_test.advanced.nest
 * @memberof module:api_test
 */

/**
 * Alpha function for testing nested module loading.
 * Accessed as `api.advanced.nest.alpha()` in the slothlet API.
 * @alias module:api_test.advanced.nest.alpha
 * @function alpha
 * @public
 * @param {string} name - Name parameter for alpha function.
 * @returns {string} Formatted string with alpha prefix.
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: "./api_tests/api_test" });
 * console.log(api_test.advanced.nest.alpha("test")); // "alpha: test"
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: "./api_tests/api_test" });
 *   console.log(api_test.advanced.nest.alpha("test")); // "alpha: test"
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: "./api_tests/api_test" });
 *   console.log(api_test.advanced.nest.alpha("test")); // "alpha: test"
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: "./api_tests/api_test" });
 * console.log(api_test.advanced.nest.alpha("test")); // "alpha: test"
 */
export function alpha(name) {
	return `alpha: ${name}`;
}
