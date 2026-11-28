/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_reload_force_shadow/peek.mjs
 *	@Date: 2026-09-29T02:01:58-07:00 (1790672518)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:23-08:00 (1795868963)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf only the overwriting module provides (#530).
 * @module api_test_reload_force_shadow.peek
 */

/**
 * @function peek
 * @returns {string} `"shadow:peek"`.
 */
export function peek() {
	return "shadow:peek";
}
