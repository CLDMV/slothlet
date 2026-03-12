/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_single_root_fn/root.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:16 -08:00 (1772425276)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root function module for api_test_single_root_fn testing.
 * @module api_test_single_root_fn.root
 * @memberof module:api_test_single_root_fn
 */
/**
 * @namespace root
 * @memberof module:api_test_single_root_fn
 * @alias module:api_test_single_root_fn.root
 */

/**
 * Single root function - acts as the callable API root.
 * @function rootFn
 * @memberof module:api_test_single_root_fn.root
 * @param {string} [input="world"] - Input string
 * @returns {string} Greeting
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
 * api.root('world'); // 'root:world'
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_single_root_fn = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
 * api_test_single_root_fn.root.rootFn();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_single_root_fn = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
 *   api_test_single_root_fn.root.rootFn();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_single_root_fn = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
 *   api_test_single_root_fn.root.rootFn();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_single_root_fn = await slothlet({ dir: './api_tests/api_test_single_root_fn' });
 * api_test_single_root_fn.root.rootFn();
 */
export default function rootFn(input = "world") {
	return `root:${input}`;
}

export const version = "1.0";
