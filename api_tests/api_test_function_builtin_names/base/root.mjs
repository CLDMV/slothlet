/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_function_builtin_names/base/root.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:05-08:00 (1795868885)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The api root's file: its default export is the root function, so the api root is callable.
 * @module api_test_function_builtin_names.root
 */

/**
 * The root function.
 * @param {*} a - First argument.
 * @param {*} b - Second argument.
 * @returns {string} `"root"`.
 * @example
 * api(1, 2); // "root"
 */
export default function rootFn(a, b) {
	return `root:${a}:${b}`;
}
