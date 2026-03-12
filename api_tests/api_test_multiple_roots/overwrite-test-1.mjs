/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multiple_roots/overwrite-test-1.mjs
 *	@Date: 2026-01-23T17:35:04-08:00 (1769218504)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:15 -08:00 (1772425275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview First overwrite test module for api_test_multiple_roots testing.
 * @module api_test_multiple_roots.overwriteTest1
 * @memberof module:api_test_multiple_roots
 */
/**
 * @namespace overwriteTest1
 * @memberof module:api_test_multiple_roots
 * @alias module:api_test_multiple_roots.overwriteTest1
 */

/**
 * Returns the overwrite-test-1 identifier.
 * @function overwriteTest
 * @memberof module:api_test_multiple_roots.overwriteTest1
 * @returns {string} 'overwrite-test-1'
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * api_test_multiple_roots.overwrite-test-1.overwriteTest();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *   api_test_multiple_roots.overwrite-test-1.overwriteTest();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *   api_test_multiple_roots.overwrite-test-1.overwriteTest();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * api_test_multiple_roots.overwrite-test-1.overwriteTest();
 */
export function overwriteTest() {
	return "overwrite-test-1";
}

/**
 * Named export that will be overwritten
 * @returns {string} Version identifier
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * api_test_multiple_roots.overwrite-test-1.conflictingName();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *   api_test_multiple_roots.overwrite-test-1.conflictingName();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *   api_test_multiple_roots.overwrite-test-1.conflictingName();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * api_test_multiple_roots.overwrite-test-1.conflictingName();
 */
export function conflictingName() {
	return "from-file-1";
}

