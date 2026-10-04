/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/run/idle.mjs
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
 * @fileoverview Host leaf that stays suspended on a gate, to hold a second call in flight.
 * @module api_test_live_suspended_caller.run.idle
 */

/**
 * Wait on the gate.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"idle"`.
 */
export async function idle(gate) {
	await gate;
	return "idle";
}
