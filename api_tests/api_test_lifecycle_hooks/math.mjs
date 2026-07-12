/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_hooks/math.mjs
 *	@Date: 2026-07-09 18:03:53 -07:00 (1783645433)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git@cldmv.net)
 *	@Last modified time: 2026-07-09 18:19:01 -07:00 (1783646341)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Ordinary leaf module for api_test_lifecycle_hooks sanity checks.
 * @module api_test_lifecycle_hooks.math
 * @memberof module:api_test_lifecycle_hooks
 */

/**
 * Adds two numbers together.
 * @function add
 * @memberof module:api_test_lifecycle_hooks.math
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} a + b
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks' });
 * api.math.add(1, 2); // 3
 */
export function add(a, b) {
	return a + b;
}
