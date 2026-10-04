/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/run/chain.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:48 -07:00 (1791082968)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Host boot chain: the outermost suspended call, awaiting `run.boot`.
 * @module api_test_live_suspended_caller.run.chain
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Await the boot step, so this call stays suspended for the whole boot.
 * @param {string} scenario - Scenario forwarded to `run.boot`.
 * @param {string} id - Extension moduleID to activate.
 * @param {Promise<void>} [gate] - Gate forwarded to the activation.
 * @returns {Promise<*>} Whatever the boot step returned.
 */
export async function chain(scenario, id, gate) {
	return await self.run.boot(scenario, id, gate);
}
