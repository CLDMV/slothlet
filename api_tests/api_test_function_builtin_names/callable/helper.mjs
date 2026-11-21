/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_builtin_names/callable/helper.mjs
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
 * @fileoverview A member of the callable mount: `<mount>.helper`.
 * @module api_test_function_builtin_names.callable.helper
 */

/**
 * Help.
 * @param {*} x - The argument.
 * @returns {string} `"help:<x>"`.
 * @example
 * api.cm.helper(1); // "help:1"
 */
export function helper(x) {
	return `help:${x}`;
}
