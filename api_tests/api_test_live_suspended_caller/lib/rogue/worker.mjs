/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/lib/rogue/worker.mjs
 *	@Date: 2026-09-28T18:00:00-07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:05:53-08:00 (1795536353)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Sibling file of the unprivileged module, where its call resumes.
 * @module api_test_live_suspended_caller.rogue.worker
 */
import { self } from "@cldmv/slothlet/runtime";
import { attempt } from "../attempt.mjs";

/**
 * Wait on the gate, then try the extension's view — which this module may not reach.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} The render result, or `"denied"`.
 */
export async function drain(gate) {
	await gate;
	return attempt(() => self.ext.views.running.render("rogue"));
}
