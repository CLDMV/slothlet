/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_member_routes/own/peek.mjs
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
 * @fileoverview A leaf of the module mounted at `own` that reads its own folder's function member by every route.
 * @module api_test_function_member_routes.own.peek
 */
import { self } from "@cldmv/slothlet/runtime";
import { routes } from "../lib/routes.mjs";

/**
 * Read `self.own.tag` by every route.
 * @function at
 * @memberof module:api_test_function_member_routes.own.peek
 * @returns {Record<string, string>} What each route answered.
 * @example
 * api.own.peek.at(); // { direct: "OWNTAG", … }
 */
export function at() {
	return routes(self.own);
}
