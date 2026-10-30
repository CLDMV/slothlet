/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round2/base/callee2/ops.mjs
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
 * @fileoverview A second callee (#597): it may call what the supplier may, so code the supplier hands it is limited
 * only by the calls that code runs inside.
 *
 * @module api_tests/api_test_caller_supplied_round2/base/callee2/ops
 */

/**
 * Call a function it was handed.
 * @param {function(): *} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.callee2.ops.run(() => 1); // 1
 */
export function run(fn) {
	return fn();
}
