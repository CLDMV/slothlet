/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_unknown_caller/ext/api/resume.mjs
 *	@Date: 2026-11-09T01:56:49-08:00 (1794218209)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T02:12:50-08:00 (1794219170)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The file both `ext.start` and `ext.peer` import: `ext.start`'s work resumes here.
 * @module api_test_unknown_caller.ext.resume
 */
import { self } from "@cldmv/slothlet/runtime";
import { attempt } from "../../shared/attempt.mjs";
import { callRender } from "../../shared/call.mjs";

/**
 * Wait on the gate, then reach the extension's own leaves.
 *
 * - `"self"`: through `self`, from this file.
 * - `"handed"`: through a node the host read and handed in, called from a helper no leaf's file holds.
 * @param {string} scenario - Which way to reach them.
 * @param {Promise<void>} gate - Released by the test.
 * @param {object} [target] - The node the host handed in.
 * @returns {Promise<*>} The results, each possibly `"denied"`.
 */
export async function afterGate(scenario, gate, target) {
	await gate;
	if (scenario === "handed") return attempt(() => callRender(target, "handed"));
	return Promise.all([
		attempt(() => self.ext.views.running.render("self")),
		attempt(
			() => self.ext.cache.context.subscribe(),
			() => "subscribed"
		)
	]);
}
