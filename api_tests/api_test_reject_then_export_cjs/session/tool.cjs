/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_export_cjs/session/tool.cjs
 *	@Date: 2026-10-08T00:00:00-07:00 (1791442800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T00:00:00-07:00 (1791442800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#571 review): a CommonJS module exporting `then`, which would make the
 * module awaitable; refused by name instead of hanging the load.
 * @module api_test_reject_then_export_cjs.session.tool
 */

module.exports = {
	/**
	 * @returns {string} Never reached: the module is refused at load.
	 */
	then() {
		return "then";
	},
	/**
	 * @returns {string} Marker naming this leaf.
	 */
	other() {
		return "session.tool.other";
	}
};
