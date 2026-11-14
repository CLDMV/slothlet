/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_globstar_zero/tools/sub.mjs
 *	@Date: 2026-11-11T20:58:48-08:00 (1794459528)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:15-08:00 (1794477375)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file inside the folder named like the root file.
 * @module api_test_globstar_zero.tools.sub
 * @memberof module:api_test_globstar_zero
 */

/**
 * A function inside the folder.
 * @function deep
 * @memberof module:api_test_globstar_zero.tools.sub
 * @returns {string} "deep"
 * @example
 * api.tools.sub.deep(); // "deep"
 */
export function deep() {
	return "deep";
}
