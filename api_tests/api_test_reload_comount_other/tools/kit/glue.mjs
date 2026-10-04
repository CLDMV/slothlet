/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_comount_other/tools/kit/glue.mjs
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
 * @fileoverview Leaf in a subfolder only the second module contributes, inside a shared one (#525).
 * @module api_test_reload_comount_other.tools.kit.glue
 */

/**
 * @function glue
 * @returns {string} `"other:glue"`.
 */
export function glue() {
	return "other:glue";
}
