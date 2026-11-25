/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_unknown_caller/api/run.mjs
 *	@Date: 2026-11-09T01:56:06-08:00 (1794218166)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T11:38:20-08:00 (1795549100)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host's own module: it starts the extension and stays suspended while the extension runs.
 * @module api_test_unknown_caller.api.run
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Start the extension and await it, so this call is a frame further out of the extension's flow.
 * @param {string} scenario - Forwarded to `ext.start`.
 * @param {Promise<void>} gate - Forwarded to `ext.start`.
 * @param {object} [target] - Forwarded to `ext.start`.
 * @returns {Promise<*>} What the extension returned.
 */
export async function chain(scenario, gate, target) {
	return await self.ext.start(scenario, gate, target);
}
