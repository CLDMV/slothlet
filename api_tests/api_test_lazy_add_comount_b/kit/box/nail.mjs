/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_add_comount_b/kit/box/nail.mjs
 *	@Date: 2026-10-02T12:32:25-07:00 (1790969545)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:27:49-07:00 (1791091669)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf two levels into a subfolder only the second module contributes (#548).
 * @module api_test_lazy_add_comount_b.kit.box.nail
 */

/**
 * @function nail
 * @returns {string} `"b:nail"`.
 */
export function nail() {
	return "b:nail";
}
