/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped_other/nested/other2.mjs
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
 * @fileoverview Ordinary sibling leaf — keeps `nested` plural so it doesn't solo-collapse onto a
 * single callable.
 * @module api_test_routines_scoped_other.nested.other2
 * @memberof module:api_test_routines_scoped_other.nested
 */

/**
 * @function other2
 * @memberof module:api_test_routines_scoped_other.nested
 * @returns {number} `1`.
 */
export default function other2() {
	return 1;
}
