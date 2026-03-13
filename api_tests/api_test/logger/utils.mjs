/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/logger/utils.mjs
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
 * @fileoverview Debug utilities for logger namespace.
 * @module api_test.logger.utils
 * @memberof module:api_test.logger
 */
/**
 * @namespace utils
 * @memberof module:api_test.logger
 * @alias module:api_test.logger.utils
 */

/**
 * Debug level logging.
 * @function debug
 * @memberof module:api_test.logger.utils
 * @param {string} message - Debug message
 * @returns {string} Formatted debug message
 * @example
 * utils.debug("loaded"); // "[DEBUG] 2026-...: loaded"
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.logger.utils.debug('value');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.logger.utils.debug('value');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.logger.utils.debug('value');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.logger.utils.debug('value');
 */
export function debug(message) {
	return `[DEBUG] ${new Date().toISOString()}: ${message}`;
}

/**
 * Error level logging
 * @param {string} message - Error message
 * @returns {string} Formatted error message
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.logger.utils.error('value');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.logger.utils.error('value');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.logger.utils.error('value');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.logger.utils.error('value');
 */
export function error(message) {
	return `[ERROR] ${new Date().toISOString()}: ${message}`;
}
