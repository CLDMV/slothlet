/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multiple_roots/conflict-2.mjs
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
 * @fileoverview Second conflicting default export for api_test_multiple_roots testing.
 * @module api_test_multiple_roots.conflict2
 * @memberof module:api_test_multiple_roots
 */
/**
 * @namespace conflict2
 * @memberof module:api_test_multiple_roots
 * @alias module:api_test_multiple_roots.conflict2
 */

/**
 * Default callable — returns the string identifier for this conflict module.
 * @function conflictingName
 * @memberof module:api_test_multiple_roots.conflict2
 * @returns {string} 'from-file-2'
 * @example
 * api.conflict2(); // 'from-file-2'
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * api_test_multiple_roots.conflict-2.conflictingName();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *   api_test_multiple_roots.conflict-2.conflictingName();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *   api_test_multiple_roots.conflict-2.conflictingName();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * api_test_multiple_roots.conflict-2.conflictingName();
 */
export default function conflictingName() {
	return "from-file-2";
}

/**
 * rootFunctionShout.
 * @param {*} name - name.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * api_test_multiple_roots.conflict-2.rootFunctionShout(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *   api_test_multiple_roots.conflict-2.rootFunctionShout(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 *   api_test_multiple_roots.conflict-2.rootFunctionShout(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_multiple_roots = await slothlet({ dir: './api_tests/api_test_multiple_roots' });
 * api_test_multiple_roots.conflict-2.rootFunctionShout(null);
 */
export function rootFunctionShout(name) {
	return `HELLO 2, ${name.toUpperCase()}!`;
}

