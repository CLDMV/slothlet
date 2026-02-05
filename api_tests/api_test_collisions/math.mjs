/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/math.mjs
 *	@Date: 2026-01-23T08:17:46-08:00 (1769185066)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:11 -08:00 (1770266411)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

export function power(base, exponent) {
	return Math.pow(base, exponent);
}

/**
 * Calculate square root of a number.
 * @param {number} n - The number.
 * @returns {number} The square root.
 */
export function sqrt(n) {
	return Math.sqrt(n);
}

/**
 * Calculate modulo of two numbers.
 * @param {number} a - First number.
 * @param {number} b - Second number.
 * @returns {number} The remainder.
 */
export function modulo(a, b) {
	return a % b;
}

/**
 * Version identifier for collision detection.
 * @type {string}
 */
export const collisionVersion = "math-collision-v1";

