/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_nested/admin/other2.mjs
 *	@Date: 2026-09-08T00:00:00-07:00 (1788850800)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:45-07:00 (1791090885)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Ordinary sibling leaf — keeps `admin` plural so it doesn't solo-collapse onto a
 * single callable (which would prevent `admin.initialize` from existing as its own property).
 * @module api_test_routines_nested.admin.other2
 * @memberof module:api_test_routines_nested.admin
 */

/**
 * @function other2
 * @memberof module:api_test_routines_nested.admin
 * @returns {number} `1`.
 */
export default function other2() {
	return 1;
}
