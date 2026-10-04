/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_comount_ext/tools/net/smtp.mjs
 *	@Date: 2026-09-29T00:13:10-07:00 (1790665990)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:42-07:00 (1791090882)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf three levels into a subfolder both co-mounted modules contribute to (#525).
 * @module api_test_reload_comount_ext.tools.net.smtp
 */

/**
 * @function smtp
 * @returns {string} `"ext:smtp"`.
 */
export function smtp() {
	return "ext:smtp";
}
