/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/task/sync-throw.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:11 -08:00 (1772425271)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Synchronous function that always throws.
 * Used to test the synchronous error suppression path in the apply trap.
 * @module api_test.task.syncThrow
 * @memberof module:api_test
 */

/**
 * Synchronous function that always throws an error.
 * Used to exercise the catch block in the apply trap (unified-wrapper lines ~2691-2713).
 * @param {string} [message="sync-threw"] - Custom error message.
 * @returns {never} Always throws.
 * @example
 * // Expect this to throw when called without suppressErrors
 * api.task.syncThrow();
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * try { api_test.task.syncThrow(); } catch (e) { /* expected *\/ }
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   try { api_test.task.syncThrow(); } catch (e) { /* expected *\/ }
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   try { api_test.task.syncThrow(); } catch (e) { /* expected *\/ }
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * try { api_test.task.syncThrow(); } catch (e) { /* expected *\/ }
 */
export default function syncThrow(message = "sync-threw") {
	throw new Error(message);
}
