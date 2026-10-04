/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_comount_ext/tools/net/http.mjs
 *	@Date: 2026-09-29 00:13:10 -07:00 (1790665990)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:03 -07:00 (1791082983)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf three levels into a subfolder both co-mounted modules contribute to (#525).
 * @module api_test_reload_comount_ext.tools.net.http
 */

/**
 * @function http
 * @returns {string} `"ext:http"`.
 */
export function http() {
	return "ext:http";
}
