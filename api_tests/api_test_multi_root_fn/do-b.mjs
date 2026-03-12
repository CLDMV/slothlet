/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multi_root_fn/do-b.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:15 -08:00 (1772425275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Function do-b module for api_test_multi_root_fn testing.
 * @module api_test_multi_root_fn.doB
 * @memberof module:api_test_multi_root_fn
 */
/**
 * @namespace doB
 * @memberof module:api_test_multi_root_fn
 * @alias module:api_test_multi_root_fn.doB
 */

/**
 * Returns result-b string.
 * @function doB
 * @memberof module:api_test_multi_root_fn.doB
 * @returns {string} 'result-b'
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
 * api.doB(); // 'result-b'
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
 * api_test_multi_root_fn.do-b.doB();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
 *   api_test_multi_root_fn.do-b.doB();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
 *   api_test_multi_root_fn.do-b.doB();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_multi_root_fn = await slothlet({ dir: './api_tests/api_test_multi_root_fn' });
 * api_test_multi_root_fn.do-b.doB();
 */
export default function doB() {
	return "result-b";
}

export const meta = { name: "doB" };
