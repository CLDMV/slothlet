/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_after_async/other.mjs
 *	@Date: 2026-10-25T01:10:21-07:00 (1792915821)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T01:33:16-07:00 (1792917196)
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
