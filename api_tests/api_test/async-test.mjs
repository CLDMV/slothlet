/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/async-test.mjs
 *	@Date: 2026-03-03 09:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 09:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Async API module for hook coverage tests.
 *
 * Provides genuinely async functions (returning Promises) so that the
 * unified-wrapper's `.then()` async result branch is exercised. This is
 * needed to reach line 2644 (suppressErrors inside the async after-hook
 * error handler), which only fires when:
 *   1. The function returns a Promise that resolves successfully.
 *   2. An after-hook throws during the `.then()` success handler.
 *   3. `config.hook.suppressErrors === true`.
 *
 * @module api_test.asyncTest
 * @memberof module:api_test
 */
/**
 * @namespace asyncTest
 * @memberof module:api_test
 */


/**
 * Async addition — returns a resolved Promise so the unified-wrapper
 * enters the `result.then(...)` async path.
 *
 * @param {number} a - First operand.
 * @param {number} b - Second operand.
 * @returns {Promise<number>} Resolved sum.
 * @example
 * await asyncAdd(2, 3); // 5
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.async-await test.asyncAdd(1, 1);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.async-await test.asyncAdd(1, 1);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.async-await test.asyncAdd(1, 1);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.async-await test.asyncAdd(1, 1);
 */
export async function asyncAdd(a, b) {
	return a + b;
}

/**
 * Async string echo — supplements asyncAdd for broader async hook coverage.
 *
 * @param {string} value - Value to echo back.
 * @returns {Promise<string>} The same value.
 * @example
 * await asyncEcho("hello"); // "hello"
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.async-await test.asyncEcho('value');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.async-await test.asyncEcho('value');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.async-await test.asyncEcho('value');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.async-await test.asyncEcho('value');
 */
export async function asyncEcho(value) {
	return value;
}
