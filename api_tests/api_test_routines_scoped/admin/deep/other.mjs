/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped/admin/deep/other.mjs
 *	@Date: 2026-09-09T00:00:00-07:00 (1788937200)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:46-07:00 (1791090886)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Ordinary sibling leaf — keeps `deep` plural so it doesn't solo-collapse onto a
 * single callable (#341), preserving it as a namespace wrapper whose own materialization state can
 * be checked independently.
 * @module api_test_routines_scoped.admin.deep.other
 * @memberof module:api_test_routines_scoped.admin.deep
 */

/**
 * @function other
 * @memberof module:api_test_routines_scoped.admin.deep
 * @returns {number} `1`.
 */
export default function other() {
	return 1;
}
