/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multi_root_fn/do-a.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:15 -08:00 (1772425275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Function do-a module for api_test_multi_root_fn testing.
 * @module api_test_multi_root_fn.doA
 * @memberof module:api_test_multi_root_fn
 */

/**
 * Returns result-a string.
 * @returns {string} "result-a"
 */
export default function doA() {
	return "result-a";
}

export const version = "1.0";
