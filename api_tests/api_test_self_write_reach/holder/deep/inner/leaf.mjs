/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/holder/deep/inner/leaf.mjs
 *	@Date: 2026-10-19T06:21:45-07:00 (1792416105)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-19T06:53:17-07:00 (1792417997)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf of the `holder` fixture (#625), under a chain of containers only `holder` owns.
 */

/**
 * @returns {string} `"holder-leaf"`.
 * @example
 * leaf(); // "holder-leaf"
 */
export function leaf() {
	return "holder-leaf";
}
