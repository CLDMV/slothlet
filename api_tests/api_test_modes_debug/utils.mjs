/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_modes_debug/utils.mjs
 *	@Date: 2026-02-27T00:00:00-08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * General utility functions for modes-processor debug coverage testing.
 * @param {string} name
 * @returns {string}
 */
export function greet(name) {
	return `Hello, ${name}!`;
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function add(a, b) {
	return a + b;
}
