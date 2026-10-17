/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity/pane/pane.mjs
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
 * @fileoverview The one call left suspended while another module's deferred work runs.
 * @module api_test_live_caller_identity.pane
 */

/**
 * Wait on the gate.
 * @param {Promise<void>} gate - Released by the test.
 * @param {Function} [entered] - Called once the body is running, so the caller knows the call is in flight.
 * @returns {Promise<string>} `"held"`.
 */
export async function hold(gate, entered) {
	entered?.();
	await gate;
	return "held";
}
