/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/co/c2/other.mjs
 *	@Date: 2026-11-04T07:41:09-08:00 (1793806869)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T07:51:19-08:00 (1793807479)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The second of two modules mounted together at one path (#653), reloaded on its own.
 */

/**
 * @returns {string} `"other"`.
 * @example
 * other(); // "other"
 */
export function other() {
	return "other";
}
