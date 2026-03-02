/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_modes_debug/logger/logger.mjs
 *	@Date: 2026-02-27T22:37:47-08:00 (1772260667)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:14 -08:00 (1772425274)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Logger API module for modes-processor debug coverage testing.
 * Uses folder/folder.mjs pattern with a default export function (Case 2).
 * @default
 */
export default function logger(msg) {
	return `[LOG] ${msg}`;
}

/** @type {string} */
export const level = "info";
