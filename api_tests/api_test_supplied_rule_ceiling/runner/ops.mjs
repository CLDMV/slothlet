/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_supplied_rule_ceiling/runner/ops.mjs
 *	@Date: 2026-11-25T01:38:18-08:00 (1795599498)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:54-08:00 (1795868994)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that runs the code its caller hands it.
 * @module api_test_supplied_rule_ceiling/runner/ops
 */

/**
 * Run a function the caller supplied.
 * @param {Function} fn - The caller's function.
 * @returns {*} What it returned.
 */
export function run(fn) {
	return fn();
}
