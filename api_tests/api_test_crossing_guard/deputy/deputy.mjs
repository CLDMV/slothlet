/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_guard/deputy/deputy.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A third module of the crossing guard fixture, which rules may let write the owner's code: runs what it
 * is handed.
 * @module api_test_crossing_guard/deputy
 */

/**
 * Run a function handed in.
 * @param {Function} fn - The function.
 * @returns {string} `"ran"`.
 */
export function run(fn) {
	fn();
	return "ran";
}
