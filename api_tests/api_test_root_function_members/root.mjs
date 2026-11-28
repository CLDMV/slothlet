/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_root_function_members/root.mjs
 *	@Date: 2026-11-15T10:00:00-08:00 (1794765600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:31-08:00 (1795868971)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The api root's file: its default export is the root function, which records each run and carries a
 * data member of its own on the function (`root.tag`).
 * @module api_test_root_function_members.root
 */

/**
 * How many times the root function has run.
 * @type {{count: number}}
 */
export const runs = { count: 0 };

/**
 * The root function.
 * @param {number} [a=0] - A number.
 * @param {number} [b=0] - Another.
 * @returns {string} `"root:<a+b>"`.
 * @example
 * api(1, 2); // "root:3"
 */
export default function root(a = 0, b = 0) {
	runs.count++;
	return `root:${a + b}`;
}
root.tag = "TAG";
