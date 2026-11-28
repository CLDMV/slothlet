/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_closed/api/root.mjs
 *	@Date: 2026-11-25T01:30:04-08:00 (1795599004)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:42-08:00 (1795868982)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * The api root: doubles its argument.
 * @param {number} n - The number.
 * @returns {number} Twice `n`.
 */
export default function root(n) {
	return n * 2;
}
