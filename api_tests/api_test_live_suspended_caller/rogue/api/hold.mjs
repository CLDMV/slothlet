/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/rogue/api/hold.mjs
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
 * @fileoverview Unprivileged call that stays suspended in its own file.
 * @module api_test_live_suspended_caller.rogue.hold
 */
import { self } from "@cldmv/slothlet/runtime";
import { attempt } from "../../shared/attempt.mjs";

/**
 * Wait on the gate, then try the extension's view.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} The render result, or `"denied"`.
 */
export async function hold(gate) {
	await gate;
	return attempt(() => self.ext.views.running.render("rogue-held"));
}
