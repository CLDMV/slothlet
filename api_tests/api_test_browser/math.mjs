/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser/math.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 07:32:31 -07:00 (1779978751)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Browser-mode test fixture — math module.
 * Used to verify that slothlet can load and expose API functions when running
 * in browser/worker mode (manifest-based, no filesystem access).
 * @module api_test_browser.math
 */

/**
 * Adds two numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 * @example add(2, 3); // 5
 */
export function add(a, b) {
	return a + b;
}

/**
 * Multiplies two numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 * @example multiply(3, 4); // 12
 */
export function multiply(a, b) {
	return a * b;
}
