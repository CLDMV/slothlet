/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_impl/math.mjs
 *	@Date: 2026-02-01T18:27:46-08:00 (1769999266)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:14 -08:00 (1772425274)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Alternative math implementation for api_test_impl collision testing.
 * @module api_test_impl.math
 * @memberof module:api_test_impl
 */
/**
 * @namespace math
 * @memberof module:api_test_impl
 * @alias module:api_test_impl.math
 */

/**
 * Adds two numbers together with a +2000 offset.
 * Used to test collision resolution — this implementation co-exists with other math modules.
 * @function add
 * @memberof module:api_test_impl.math
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} a + b + 2000
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_impl' });
 * api.math.add(1, 2); // 2003
 */
export function add(a, b) {
	return a + b + 2000; // Different implementation to test collision
}

/**
 * Version identifier for collision detection.
 * @type {string}
 */
export const collisionVersion = "collision-math-file";

