/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round3/callee/__lib/helper.cjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS helper the callee requires (#597): a frame in it is the callee's code, and code compiled
 * under its file name is not.
 *
 * @module api_tests/api_test_caller_supplied_round3/callee/__lib/helper
 */

"use strict";

/**
 * Double a number.
 * @param {number} value - The number.
 * @returns {number} Twice it.
 * @public
 * @example
 * double(2); // 4
 */
function double(value) {
	return value * 2;
}

/**
 * Call a function.
 * @param {function(): *} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * apply(() => 1); // 1
 */
function apply(fn) {
	return fn();
}

module.exports = { apply, double };
