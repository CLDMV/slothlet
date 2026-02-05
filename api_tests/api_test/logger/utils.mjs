/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/logger/utils.mjs
 *	@Date: 2026-01-04T16:31:08-08:00 (1767573068)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:05 -08:00 (1770266405)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

export function debug(message) {
	return `[DEBUG] ${new Date().toISOString()}: ${message}`;
}

/**
	* Error level logging
	* @param {string} message - Error message
	* @returns {string} Formatted error message
	*/
export function error(message) {
	return `[ERROR] ${new Date().toISOString()}: ${message}`;
}







