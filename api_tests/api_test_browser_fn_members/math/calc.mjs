/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_fn_members/math/calc.mjs
 *	@Date: 2026-11-15T12:30:32-08:00 (1794774632)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:05:15-08:00 (1794776715)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A default function beside named exports called like the function, `name` and `length`.
 * @module api_test_browser_fn_members/math/calc
 */

/**
 * The default function.
 * @param {number} a - First addend.
 * @param {number} b - Second addend.
 * @returns {number} The sum.
 */
export default function calc(a, b) {
	return a + b;
}

/**
 * Exported under the default function's name.
 * @returns {string} Its name.
 */
function calc2() {
	return "calc2";
}

export { calc2 as calc };

/** A named export called like a function's own `name`. */
export const name = "N";

/** A named export called like a function's own `length`. */
export const length = 7;

/**
 * A plain named export.
 * @returns {string} Its name.
 */
export function helper() {
	return "helper";
}
