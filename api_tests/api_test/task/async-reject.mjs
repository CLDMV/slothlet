/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/task/async-reject.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 21:33:05 -07:00 (1773376385)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Async function that always rejects — used to test async rejection path in the unified-wrapper apply trap.
 * @module api_test.task.asyncReject
 * @memberof module:api_test
 */
/**
 * Async function that always rejects with an error.
 * Used in tests to exercise the async rejection path in the unified-wrapper apply trap.
 *
 * @function asyncReject
 * @public
 * @async
 * @param {string} [message="async-rejected"] - Custom error message.
 * @returns {Promise<never>} Always rejects.
 * @example
 * try {
 *   await api.task.asyncReject();
 * } catch (err) {
 *   console.log(err.message); // "async-rejected"
 * }
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.task.async-await reject.asyncReject();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.task.async-await reject.asyncReject();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.task.async-await reject.asyncReject();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.task.async-await reject.asyncReject();
 */
export default async function asyncReject(message = "async-rejected") {
	throw new Error(message);
}
