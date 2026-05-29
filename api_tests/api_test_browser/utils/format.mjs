/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser/utils/format.mjs
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
 * @fileoverview Browser-mode test fixture — nested utils/format module.
 * Tests that the browser path correctly recurses into subdirectories.
 * @module api_test_browser.utils.format
 */

/**
 * Converts a string to upper case.
 * @param {string} s
 * @returns {string}
 * @example upper("hello"); // "HELLO"
 */
export function upper(s) {
	return String(s).toUpperCase();
}

/**
 * Converts a string to lower case.
 * @param {string} s
 * @returns {string}
 * @example lower("WORLD"); // "world"
 */
export function lower(s) {
	return String(s).toLowerCase();
}
