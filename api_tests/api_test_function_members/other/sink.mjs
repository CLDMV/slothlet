/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members/other/sink.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T00:00:00-08:00 (1793692800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — a module the callers may call, handed a node of the callee's.
 *
 * @module api_tests/api_test_function_members/other/sink
 */

/**
 * Take a value handed over and report what kind it is.
 * @param {*} value - The value.
 * @returns {string} Its `typeof`.
 * @public
 * @example
 * take({}); // "object"
 */
export function take(value) {
	return typeof value;
}
