/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity/a/a.mjs
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
 * @fileoverview A call that enters first and settles first, so it restores the shared fields while a later call is still in flight.
 * @module api_test_live_caller_identity.a
 */

/**
 * Wait on the gate.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"a"`.
 */
export async function slow(gate) {
	await gate;
	return "a";
}
