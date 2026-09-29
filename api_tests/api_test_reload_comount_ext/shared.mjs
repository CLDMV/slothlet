/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_comount_ext/shared.mjs
 *	@Date: 2026-09-28 22:25:33 -07:00 (1790659533)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 23:24:25 -07:00 (1790663065)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Leaf both co-mounted modules export under the same name (#525).
 * @module api_test_reload_comount_ext.shared
 */

/**
 * @function shared
 * @returns {string} `"ext:shared"`.
 */
export function shared() {
	return "ext:shared";
}
