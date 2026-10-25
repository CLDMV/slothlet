/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_lazy_waiting/other.mjs
 *	@Date: 2026-10-25T02:50:59-07:00 (1792921859)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T03:12:47-07:00 (1792923167)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module with a call that stays suspended until the test releases it.
 */

/**
 * Wait for `gate`.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} "held".
 */
export async function hold(gate) {
	await gate;
	return "held";
}
