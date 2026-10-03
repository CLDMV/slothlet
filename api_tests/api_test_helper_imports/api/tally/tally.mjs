/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/api/tally/tally.mjs
 *	@Date: 2026-09-28 20:29:31 -07:00 (1790652571)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 20:49:48 -07:00 (1790653788)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview ESM leaf whose state lives in relatively imported helpers (#518).
 * @module api_test_helper_imports.tally
 */
import { bump, chainBump } from "../../lib/state.mjs";
import { nestedBump } from "./__lib/nested.mjs";

/**
 * Bump the shared `lib/state.mjs` counter.
 * @returns {number} The counter after incrementing.
 */
export function count() {
	return bump();
}

/**
 * Bump the counter at the bottom of the two-level helper chain.
 * @returns {number} The counter after incrementing.
 */
export function chain() {
	return chainBump();
}

/**
 * Bump the helper nested inside the api folder.
 * @returns {number} The counter after incrementing.
 */
export function nested() {
	return nestedBump();
}
