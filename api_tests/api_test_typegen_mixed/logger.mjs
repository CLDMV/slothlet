/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typegen_mixed/logger.mjs
 *	@Date: 2026-09-28T00:01:45-07:00 (1790578905)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:04-07:00 (1791091684)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Callable container: a default function with named members merged onto it
 * (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.logger
 */

/**
 * Log a message.
 * @param {string} message - Message to log.
 * @returns {string} The formatted line.
 */
export default function logger(message) {
	return `[log] ${message}`;
}

/**
 * Log an informational message.
 * @param {string} message - Message to log.
 * @returns {string} The formatted line.
 */
export function info(message) {
	return `[info] ${message}`;
}

/** Numeric log level. */
export const LEVEL = 2;
