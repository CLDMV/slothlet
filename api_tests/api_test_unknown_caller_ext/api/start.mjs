/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_unknown_caller_ext/api/start.mjs
 *	@Date: 2026-11-09T01:56:06-08:00 (1794218166)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:59-08:00 (1795868999)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The extension's entry (`ext.start`). A plain function on purpose: it hands back the promise of the
 * lib file it imports, so its own frame is gone when that work resumes.
 * @module api_test_unknown_caller_ext.api.start
 */
import { afterGate } from "../lib/resume.mjs";

/**
 * Start a scenario.
 * @param {string} scenario - `"self"` or `"handed"`.
 * @param {Promise<void>} gate - Released by the test.
 * @param {object} [target] - A node the host read, for `"handed"`.
 * @returns {Promise<*>} The scenario's result.
 */
export function start(scenario, gate, target) {
	return afterGate(scenario, gate, target);
}
