/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_member_routes/own/own.mjs
 *	@Date: 2026-11-15T13:40:33-08:00 (1794778833)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T17:00:31-08:00 (1794790831)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder's own function, carrying a data member of its own (`own.tag`): mounted at `own`, it is the
 * node `api.own`.
 * @module api_test_function_member_routes.own
 */

/**
 * The folder's function.
 * @returns {string} `"own"`.
 * @example
 * api.own(); // "own"
 */
export default function own() {
	return "own";
}
own.tag = "OWNTAG";
