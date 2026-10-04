/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/lib/cjs-state.cjs
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
 * @fileoverview CommonJS helper required by the `.cjs` leaves; requires a second-level helper (#518).
 * @module api_test_helper_imports.lib.cjsState
 * @internal
 */
const inner = require("./cjs-inner.cjs");

let count = 0;

module.exports = {
	/**
	 * Increment this module's counter.
	 * @returns {number} The counter after incrementing.
	 */
	bump() {
		return ++count;
	},
	/**
	 * Increment the second-level helper's counter.
	 * @returns {number} The counter after incrementing.
	 */
	innerBump() {
		return inner.bump();
	}
};
