/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/lib/cjs-inner.cjs
 *	@Date: 2026-09-28T20:29:31-07:00 (1790652571)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:27:48-07:00 (1791091668)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Second-level CommonJS helper (#518).
 * @module api_test_helper_imports.lib.cjsInner
 * @internal
 */
let count = 0;

module.exports = {
	/**
	 * Increment this module's counter.
	 * @returns {number} The counter after incrementing.
	 */
	bump() {
		return ++count;
	}
};
