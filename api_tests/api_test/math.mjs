/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/math.mjs
 *	@Date: 2026-01-22T22:36:56-08:00 (1769150216)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:10 -08:00 (1772425270)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview File-level collision test - collides with math/ folder.
 * Both this file and the math/ folder resolve to `api.math` and are merged.
 * @module api_test.math
 * @memberof module:api_test
 */

/**
 * Alternative math implementation that collides with math/ folder.
 * @param {number} a - First number.
 * @param {number} b - Second number.
 * @returns {number} Sum of the two numbers.
 */
export function add(a, b) {
	return a + b + 1000; // Different implementation to test collision
}

/**
 * Version identifier for collision detection.
 * @type {string}
 */
export const collisionVersion = "collision-math-file";
