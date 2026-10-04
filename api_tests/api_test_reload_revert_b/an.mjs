/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_revert_b/an.mjs
 *	@Date: 2026-09-29T00:10:26-07:00 (1790665826)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:43-07:00 (1791090883)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf both modules export at the same path; the overriding module's version (#525).
 * @module api_test_reload_revert_b.an
 */

/**
 * @function an
 * @returns {string} `"B:an"`.
 */
export function an() {
	return "B:an";
}
