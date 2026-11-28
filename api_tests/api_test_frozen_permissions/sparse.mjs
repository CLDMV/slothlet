/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_frozen_permissions/sparse.mjs
 *	@Date: 2026-10-12T23:11:20-07:00 (1791871880)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:04-08:00 (1795868884)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture: a sparse array of the largest legal length holding two elements.
 */

export const big = ["a", "b"];
big.length = 4294967295;
