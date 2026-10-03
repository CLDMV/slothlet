/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/api/tally/__lib/nested.mjs
 *	@Date: 2026-09-28 20:29:31 -07:00 (1790652571)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 20:49:48 -07:00 (1790653788)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Helper inside the api folder, hidden from the scan by its `__` folder (#518).
 * @module api_test_helper_imports.api.tally.nested
 * @internal
 */
let count = 0;

/**
 * Increment this module's counter.
 * @returns {number} The counter after incrementing.
 */
export function nestedBump() {
	return ++count;
}
