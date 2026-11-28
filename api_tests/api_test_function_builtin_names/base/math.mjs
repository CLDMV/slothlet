/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_function_builtin_names/base/math.mjs
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
 * @fileoverview A file of functions: `math.add` is a function node, and `math.helpers.twice` a function held in data.
 * @module api_test_function_builtin_names.math
 */

/**
 * Add two numbers.
 * @param {number} a - First.
 * @param {number} b - Second.
 * @returns {number} The sum.
 * @example
 * api.math.add(1, 2); // 3
 */
export function add(a, b) {
	return a + b;
}

/** Plain data holding a function of its own. */
export const helpers = {
	/**
	 * Double a number.
	 * @param {number} x - The number.
	 * @returns {number} Twice `x`.
	 */
	twice(x) {
		return x * 2;
	}
};
