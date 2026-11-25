/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_name_routes/lib/capture.mjs
 *	@Date: 2026-11-25T14:52:50-08:00 (1795647170)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:03:27-08:00 (1795651407)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Records every call into a function the fixture planted under a name with the framework's prefix.
 * @module api_test_framework_name_routes.lib.capture
 */

const seen = [];

/**
 * A function to plant under `name`, recording each call.
 * @param {string} name - The name it is planted under.
 * @returns {Function} The function.
 */
export function planted(name) {
	return function () {
		seen.push(name);
		return undefined;
	};
}

/**
 * The calls recorded so far.
 * @returns {string[]} The names called.
 */
export function calls() {
	return [...seen];
}
