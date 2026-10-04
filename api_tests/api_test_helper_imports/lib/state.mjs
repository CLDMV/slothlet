/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/lib/state.mjs
 *	@Date: 2026-09-28 20:29:31 -07:00 (1790652571)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:39 -07:00 (1791082959)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module-level counter imported by several leaves, OUTSIDE the api folder (#518).
 * Imports a two-level helper chain so isolation is proven below the first import.
 * @module api_test_helper_imports.lib.state
 * @internal
 */
import { level1Bump } from "./chain/level1.mjs";

let count = 0;

/**
 * Increment this module's counter.
 * @returns {number} The counter after incrementing.
 */
export function bump() {
	return ++count;
}

/**
 * Increment the counter at the bottom of the two-level chain.
 * @returns {number} The chain counter after incrementing.
 */
export function chainBump() {
	return level1Bump();
}
