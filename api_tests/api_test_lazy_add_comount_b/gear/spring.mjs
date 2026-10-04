/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_add_comount_b/gear/spring.mjs
 *	@Date: 2026-10-02 12:32:25 -07:00 (1790969545)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:41 -07:00 (1791082961)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Second leaf in a subfolder only the second module contributes (#548).
 * @module api_test_lazy_add_comount_b.gear.spring
 */

/**
 * @function spring
 * @returns {string} `"b:spring"`.
 */
export function spring() {
	return "b:spring";
}
