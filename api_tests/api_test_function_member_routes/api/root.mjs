/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_function_member_routes/api/root.mjs
 *	@Date: 2026-11-15T13:40:33-08:00 (1794778833)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:06-08:00 (1795868886)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The api root's file: its default export is the root function, which carries a data member of its own
 * (`root.tag`).
 * @module api_test_function_member_routes.root
 */

/**
 * The root function.
 * @param {number} [a=0] - A number.
 * @param {number} [b=0] - Another.
 * @returns {string} `"root:<a+b>"`.
 * @example
 * api(1, 2); // "root:3"
 */
export default function root(a = 0, b = 0) {
	return `root:${a + b}`;
}
root.tag = "TAG";
