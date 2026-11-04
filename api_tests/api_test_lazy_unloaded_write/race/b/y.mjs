/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/race/b/y.mjs
 *	@Date: 2026-11-04T07:11:17-08:00 (1793805077)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T07:22:51-08:00 (1793805771)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A sibling of `a`, reloaded on its own while `a` loads (#653).
 */

/**
 * @returns {string} `"y"`.
 * @example
 * y(); // "y"
 */
export function y() {
	return "y";
}
