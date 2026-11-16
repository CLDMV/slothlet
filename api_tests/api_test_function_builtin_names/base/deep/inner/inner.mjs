/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_builtin_names/base/deep/inner/inner.mjs
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
 * @fileoverview A function two folders down: `deep.inner.walk`.
 * @module api_test_function_builtin_names.deep.inner
 */

/**
 * Walk three steps.
 * @param {*} a - First.
 * @param {*} b - Second.
 * @param {*} c - Third.
 * @returns {string} The steps joined.
 * @example
 * api.deep.inner.walk(1, 2, 3); // "1/2/3"
 */
export function walk(a, b, c) {
	return `${a}/${b}/${c}`;
}
