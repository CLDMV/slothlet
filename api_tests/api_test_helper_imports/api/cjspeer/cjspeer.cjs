/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/api/cjspeer/cjspeer.cjs
 *	@Date: 2026-09-28 20:29:31 -07:00 (1790652571)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:39 -07:00 (1791082959)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Second CommonJS leaf requiring the same helper as `cjsleaf` — within one instance
 * both must see ONE helper copy (#518).
 * @module api_test_helper_imports.cjspeer
 */
const state = require("../../lib/cjs-state.cjs");

module.exports = {
	/**
	 * Bump the `lib/cjs-state.cjs` counter.
	 * @returns {number} The counter after incrementing.
	 */
	count() {
		return state.bump();
	}
};
