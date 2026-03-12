/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/funcmod/funcmod.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-10 23:40:33 -07:00 (1773211233)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Function module for testing slothlet loader with single function export. Internal file (not exported in package.json).
 * @module api_test.funcmod
 * @memberof module:api_test
 */
/**
 * @namespace funcmod
 * @memberof module:api_test
 */

/**
 * Main callable function for the funcmod module.
 * Accessed as `api.funcmod(name)` in the slothlet API.
 * @function funcmod
 * @alias module:api_test.funcmod
 * @memberof module:api_test
 * @param {string} name - Name to use in greeting
 * @returns {string} Greeting message
 * @example
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.funcmod('World')); // 'Hello, World!'
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.funcmod.funcmod('myName');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.funcmod.funcmod('myName');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.funcmod.funcmod('myName');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.funcmod.funcmod('myName');
 */
export default function (name) {
	return `Hello, ${name}!`;
}
