/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_comount_other/tools/net/ping.mjs
 *	@Date: 2026-09-29 00:13:10 -07:00 (1790665990)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:05 -07:00 (1791082985)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf both co-mounted modules export three levels down (#525).
 * @module api_test_reload_comount_other.tools.net.ping
 */

/**
 * @function ping
 * @returns {string} `"other:ping"`.
 */
export function ping() {
	return "other:ping";
}
