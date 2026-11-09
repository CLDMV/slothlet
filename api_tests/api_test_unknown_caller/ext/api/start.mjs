/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_unknown_caller/ext/api/start.mjs
 *	@Date: 2026-11-09T02:00:00-08:00 (1794222000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T02:00:00-08:00 (1794222000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The extension's entry (`ext.start`). A plain function on purpose: it hands back the promise of the
 * sibling file, so its own frame is gone when that work resumes.
 * @module api_test_unknown_caller.ext.start
 */
import { afterGate } from "./resume.mjs";

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
