/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_builtin_names/base/named/named.mjs
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
 * @fileoverview The folder's function: `api.named` is callable, and the folder's `name.mjs` and `length.mjs` are its
 * members `api.named.name` and `api.named.length`, the module's own data.
 * @module api_test_function_builtin_names.named
 */

/**
 * The folder's function.
 * @param {*} a - The argument.
 * @returns {string} `"tool:<a>"`.
 * @example
 * api.named(1); // "tool:1"
 */
export default function tool(a) {
	return `tool:${a}`;
}
