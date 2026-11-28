/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_live_kept_gaps/base/other.mjs
 *	@Date: 2026-10-25T09:23:42-07:00 (1792945422)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:43-08:00 (1795868923)
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
