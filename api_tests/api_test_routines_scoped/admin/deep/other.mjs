/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped/admin/deep/other.mjs
 *	@Date: 2026-09-09 00:00:00 -07:00 (1788886400)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-09 00:00:00 -07:00 (1788886400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
