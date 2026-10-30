/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/callee/__lib/helper.cts
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A TypeScript CommonJS helper of the callee's (#597): Node strips its types before compiling it, so its
 * frames run a script whose source is not the file's text.
 *
 * @module api_tests/api_test_caller_supplied_round5/callee/__lib/helper
 */

/**
 * Run a function.
 * @param {Function} fn - The function.
 * @returns {*} What it returned.
 */
function apply(fn: () => unknown): unknown {
	const result: unknown = fn();
	return result;
}

module.exports = { apply };
