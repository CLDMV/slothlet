/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/rogue/api/fanout.mjs
 *	@Date: 2026-09-28T18:00:00-07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:37-07:00 (1791090877)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unprivileged leaf that starts a privileged call and, without awaiting it, makes its own.
 * @module api_test_live_suspended_caller.rogue.fanout
 */
import { self } from "@cldmv/slothlet/runtime";
import { attempt } from "../../shared/attempt.mjs";

/**
 * Start `run.quick` (privileged, suspends at once), then synchronously try the extension's view.
 * The live runtime's caller field names `run.quick` at that moment; the call is still this leaf's.
 * @returns {Promise<string>} The render result, or `"denied"`.
 */
export async function fanout() {
	const pending = self.run.quick();
	const result = attempt(() => self.ext.views.running.render("fanout"));
	await pending;
	return result;
}
