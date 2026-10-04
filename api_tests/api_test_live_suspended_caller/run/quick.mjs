/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/run/quick.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:49 -07:00 (1791082969)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Privileged async host leaf that settles after one microtask.
 * @module api_test_live_suspended_caller.run.quick
 */

/**
 * Settle after a microtask.
 * @returns {Promise<string>} `"quick"`.
 */
export async function quick() {
	await null;
	return "quick";
}
