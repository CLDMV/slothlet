/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_function_builtin_names/exported/calc/calc.mjs
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
 * @fileoverview A default function beside named `name` and `length` exports: the exports are the module's data and
 * win over the function's built-in values under merge (T29), so `<mount>.calc.name` is `"custom-name"`.
 * @module api_test_function_builtin_names.exported.calc
 */

/**
 * The file's function.
 * @param {*} a - First.
 * @param {*} b - Second.
 * @returns {string} The two joined.
 * @example
 * api.ext.calc(1, 2); // "1+2"
 */
export default function calc(a, b) {
	return `${a}+${b}`;
}

/** The module's own `name` member. */
export const name = "custom-name";

/** The module's own `length` member. */
export const length = 7;
