/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_globstar_zero/tools.mjs
 *	@Date: 2026-11-11T20:58:48-08:00 (1794459528)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:16-08:00 (1794477376)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A root file named like a folder beside it, for a `hidden` glob ending in `.**`.
 * @module api_test_globstar_zero.tools
 * @memberof module:api_test_globstar_zero
 */

/**
 * A function of the root file.
 * @function top
 * @memberof module:api_test_globstar_zero.tools
 * @returns {string} "top"
 * @example
 * api.tools.top(); // "top"
 */
export function top() {
	return "top";
}
