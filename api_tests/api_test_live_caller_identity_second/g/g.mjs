/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity_second/g/g.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second instance, created first, so it is the one the live runtime rests on.
 * @module api_test_live_caller_identity_second.g
 */

/**
 * Answer.
 * @returns {string} `"g"`.
 */
export function ping() {
	return "g";
}

/**
 * Wait on the gate, holding a call of this instance in flight.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"g"`.
 */
export async function hold(gate) {
	await gate;
	return "g";
}
