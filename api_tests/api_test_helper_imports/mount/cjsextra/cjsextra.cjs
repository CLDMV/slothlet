/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/mount/cjsextra/cjsextra.cjs
 *	@Date: 2026-09-28 23:11:25 -07:00 (1790662285)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 23:21:40 -07:00 (1790662900)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CommonJS leaf mounted with `api.slothlet.api.add` that requires the same helper as
 * the base `.cjs` leaves — within one instance both must see ONE helper copy (#518).
 * @module api_test_helper_imports.mount.cjsextra
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
