/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/ext/api/resume.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:47 -07:00 (1791082967)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A sibling file of the extension where an activation resumes after its `await`.
 * @module api_test_live_suspended_caller.ext.resume
 */
import { self } from "@cldmv/slothlet/runtime";
import { attempt } from "../../shared/attempt.mjs";

/**
 * Wait on the gate, then reach the extension's own leaves from this sibling file.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<Array<string>>} The render and subscribe results, each possibly `"denied"`.
 */
export async function afterGate(gate) {
	await gate;
	return Promise.all([
		attempt(() => self.ext.views.running.render("sibling")),
		attempt(
			() => self.ext.usage.cache.context.subscribe(() => {}),
			() => "subscribed"
		)
	]);
}

/**
 * Take references to the extension's own leaves and to the permissions namespace up front, wait on
 * the gate, then use them from this sibling file. Each use is gated on whoever is running when it is
 * made.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<Array<string>>} The render, subscribe and rule-read results, each possibly `"denied"`.
 */
export async function afterGateCaptured(gate) {
	const render = self.ext.views.running.render;
	const subscribe = self.ext.usage.cache.context.subscribe;
	const permissions = self.slothlet.permissions;
	await gate;
	return Promise.all([
		attempt(() => render("sibling")),
		attempt(
			() => subscribe(() => {}),
			() => "subscribed"
		),
		attempt(
			() => permissions.global.rulesForPath("ext.views.running.render"),
			() => "read"
		)
	]);
}
