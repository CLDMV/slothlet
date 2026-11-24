/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/api/run/quick.mjs
 *	@Date: 2026-09-28T18:00:00-07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:05:53-08:00 (1795536353)
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
