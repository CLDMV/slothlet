/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_uwb_fn_members/valued.mjs
 *	@Date: 2026-11-25T01:43:57-08:00 (1795599837)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:08:00-08:00 (1795601280)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function carrying its own `valueOf` and `toString`.
 */

/**
 * The module's function.
 * @returns {string} A label.
 */
function valued() {
	return "valued";
}

valued.valueOf = function () {
	return 42;
};

valued.toString = function () {
	return "valued!";
};

export default valued;
