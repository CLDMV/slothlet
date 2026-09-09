/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped/admin/other.mjs
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
 * @fileoverview Ordinary sibling leaf — keeps `admin` plural so it doesn't solo-collapse onto a
 * single callable (which would prevent `admin.initialize` from existing as its own property).
 * @module api_test_routines_scoped.admin.other
 * @memberof module:api_test_routines_scoped.admin
 */

/**
 * @function other
 * @memberof module:api_test_routines_scoped.admin
 * @returns {number} `1`.
 */
export default function other() {
	return 1;
}
