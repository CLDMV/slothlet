/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_folder_dedupe/deep/deep/other.mjs
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
 * @fileoverview `deep/deep/other.mjs` of the same-named folder fixture (#743): reached at `api.deep.other`.
 * @module api_test_folder_dedupe.deep.other
 * @memberof module:api_test_folder_dedupe
 */

/**
 * The api path this function is reached at.
 * @function where
 * @memberof module:api_test_folder_dedupe.deep.other
 * @returns {string} "deep.other.where"
 * @example
 * api.deep.other.where(); // "deep.other.where"
 */
export function where() {
	return "deep.other.where";
}
