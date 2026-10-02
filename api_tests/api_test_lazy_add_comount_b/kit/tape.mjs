/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_add_comount_b/kit/tape.mjs
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
 * @fileoverview Leaf in a subfolder only the second module contributes (#548).
 * @module api_test_lazy_add_comount_b.kit.tape
 */

/**
 * @function tape
 * @returns {string} `"b:tape"`.
 */
export function tape() {
	return "b:tape";
}
