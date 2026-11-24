/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_parity_siblingroot/api/root.mjs
 *	@Date: 2026-11-15T17:03:37-08:00 (1794791017)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:06:37-08:00 (1795536397)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * The api root, an arrow exported by name: doubles its argument.
 * @param {number} n - The number.
 * @returns {number} Twice `n`.
 */
const root = (n) => n * 2;
export default root;
