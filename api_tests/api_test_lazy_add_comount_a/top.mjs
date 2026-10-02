/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_add_comount_a/top.mjs
 *	@Date: 2026-10-02 12:32:25 -07:00 (1790969545)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02 12:37:59 -07:00 (1790969879)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Leaf only the first module contributes (#548).
 * @module api_test_lazy_add_comount_a.top
 */

/**
 * @function top
 * @returns {string} `"a:top"`.
 */
export function top() {
	return "a:top";
}
