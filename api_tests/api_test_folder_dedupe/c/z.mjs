/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_folder_dedupe/c/z.mjs
 *	@Date: 2026-11-11T21:25:45-08:00 (1794461145)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:00-08:00 (1794477360)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `c/z.mjs` of the same-named folder fixture (#743): reached at `api.c.z`.
 * @module api_test_folder_dedupe.c.z
 * @memberof module:api_test_folder_dedupe
 */

/**
 * The api path this function is reached at.
 * @function where
 * @memberof module:api_test_folder_dedupe.c.z
 * @returns {string} "c.z.where"
 * @example
 * api.c.z.where(); // "c.z.where"
 */
export function where() {
	return "c.z.where";
}
