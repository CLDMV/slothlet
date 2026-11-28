/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwb_hooks/math.mjs
 *	@Date: 2026-11-25T01:38:31-08:00 (1795599511)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:02-08:00 (1795869002)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Plain functions for hooks to wrap.
 */

/**
 * Add two numbers.
 * @param {number} a - First.
 * @param {number} b - Second.
 * @returns {number} The sum.
 */
export function add(a, b) {
	return a + b;
}

/**
 * Multiply two numbers.
 * @param {number} a - First.
 * @param {number} b - Second.
 * @returns {Promise<number>} The product.
 */
export async function mul(a, b) {
	return a * b;
}
