/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/ext/api/entry.mjs
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
 * @fileoverview The extension's public entry — the one leaf the host may call directly.
 * @module api_test_live_suspended_caller.ext.entry
 */
import { self } from "@cldmv/slothlet/runtime";
import { attempt } from "../../shared/attempt.mjs";

/**
 * Synchronously reach the extension's own leaves. Both calls are made before this returns; only
 * their results are awaited.
 * @returns {Promise<Array<string>>} The render and subscribe results, each possibly `"denied"`.
 */
export function start() {
	return Promise.all([
		attempt(() => self.ext.views.running.render("nested")),
		attempt(
			() => self.ext.usage.cache.context.subscribe(() => {}),
			() => "subscribed"
		)
	]);
}

/**
 * Stay suspended on the gate — a second api path of this module in flight at the same time.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"waited"`.
 */
export async function wait(gate) {
	await gate;
	return "waited";
}
