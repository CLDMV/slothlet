/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/logger/logger.mjs
 *	@Date: 2026-01-04T16:31:08-08:00 (1767573068)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 21:33:02 -07:00 (1773376382)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Main logger function for callable namespace test.
 * @module api_test.logger
 * @memberof module:api_test
 */
/**
 * @namespace logger
 * @memberof module:api_test
 */

/**
 * Main callable log function for the logger module.
 * Accessed as `api.logger(message)` in the slothlet API.
 * @function logger
 * @alias module:api_test.logger
 * @memberof module:api_test
 * @param {string} message - Message to log
 * @returns {string} Formatted log string with ISO timestamp
 * @example
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.logger('hello')); // '[LOG] 2026-...: hello'
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.logger.logger('value');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.logger.logger('value');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.logger.logger('value');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.logger.logger('value');
 */
export default function log(message) {
	return `[LOG] ${new Date().toISOString()}: ${message}`;
}
