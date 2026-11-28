/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_toplevel_callable_root/root.mjs
 *	@Date: 2026-11-11T12:19:09-08:00 (1794428349)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:55-08:00 (1795868995)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file at the root of the base folder whose default export is a function: the api itself is callable.
 * @module api_test_toplevel_callable_root/root
 */

/**
 * The api called as a function.
 * @returns {string} `"root"`.
 */
export default function root() {
	return "root";
}

export const extra = () => "extra";
