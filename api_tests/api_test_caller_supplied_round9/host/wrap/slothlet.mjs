/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round9/host/wrap/slothlet.mjs
 *	@Date: 2026-10-18T12:34:35-07:00 (1792352075)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T12:52:01-07:00 (1792353121)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Host code of the application's own whose file happens to be named `slothlet.mjs` (#597).
 *
 * @module api_tests/api_test_caller_supplied_round9/host/wrap/slothlet
 */

/**
 * Run a function.
 * @param {function(): *} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * run(() => 1); // 1
 */
export function run(fn) {
	const result = fn();
	return result;
}
