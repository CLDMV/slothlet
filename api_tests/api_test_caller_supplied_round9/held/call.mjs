/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round9/held/call.mjs
 *	@Date: 2026-10-18T12:39:09-07:00 (1792352349)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T12:52:00-07:00 (1792353120)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code inside a folder being built (#597): it calls back, so its own frame is on the stack.
 *
 * @module api_tests/api_test_caller_supplied_round9/held/call
 */

/**
 * Call a function from this file.
 * @param {function(): *} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * callFrom(() => 1); // 1
 */
export function callFrom(fn) {
	const result = fn();
	return result;
}
