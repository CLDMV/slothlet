/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_add_collision/core/math.mjs
 *	@Date: 2026-11-18T20:34:46-08:00 (1795062886)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T20:54:37-08:00 (1795064077)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `core`'s math leaf; `extra` has no math, so nothing collides with it.
 */

/**
 * Add two numbers.
 * @param {number} a - First.
 * @param {number} b - Second.
 * @returns {number} The sum.
 * @example
 * add(1, 2); // 3
 */
export const add = (a, b) => a + b;
