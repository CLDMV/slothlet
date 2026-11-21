/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_builtin_names/callable/root.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder whose root file's default export is a function, added by the host at a mount: the mount is
 * callable, and the folder's other file is a member of it (`<mount>.helper`).
 * @module api_test_function_builtin_names.callable.root
 */

/**
 * The mount's function.
 * @param {*} a - First.
 * @param {*} b - Second.
 * @param {*} c - Third.
 * @param {*} d - Fourth.
 * @returns {string} The four joined.
 * @example
 * api.cm(1, 2, 3, 4); // "1,2,3,4"
 */
export default function mounted(a, b, c, d) {
	return [a, b, c, d].join(",");
}
