/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_member_exports/lib/capture.mjs
 *	@Date: 2026-11-25T13:15:06-08:00 (1795641306)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:40:45-08:00 (1795642845)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Records each call the framework makes into the fixture's functions, kept outside the api trees.
 * @module api_test_framework_member_exports.lib.capture
 */

const seen = [];

/**
 * Record one call.
 * @param {string} name - The member that was called.
 * @returns {void}
 */
export function note(name) {
	seen.push(name);
}

/**
 * The calls recorded so far.
 * @returns {string[]} A copy of the names, in call order.
 */
export function calls() {
	return [...seen];
}
