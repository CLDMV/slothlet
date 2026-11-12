/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_folder_dedupe/a/b/y.mjs
 *	@Date: 2026-11-11T21:25:45-08:00 (1794461145)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:55:59-08:00 (1794477359)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `a/b/y.mjs` of the same-named folder fixture (#743): reached at `api.a.b.y`.
 * @module api_test_folder_dedupe.a.b.y
 * @memberof module:api_test_folder_dedupe
 */

/**
 * The api path this function is reached at.
 * @function where
 * @memberof module:api_test_folder_dedupe.a.b.y
 * @returns {string} "a.b.y.where"
 * @example
 * api.a.b.y.where(); // "a.b.y.where"
 */
export function where() {
	return "a.b.y.where";
}
