/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_comount_other/tools/kit/tape.mjs
 *	@Date: 2026-09-29T00:13:10-07:00 (1790665990)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:27:59-07:00 (1791091679)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf in a subfolder only the second module contributes, inside a shared one (#525).
 * @module api_test_reload_comount_other.tools.kit.tape
 */

/**
 * @function tape
 * @returns {string} `"other:tape"`.
 */
export function tape() {
	return "other:tape";
}
