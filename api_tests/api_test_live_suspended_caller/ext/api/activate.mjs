/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/ext/api/activate.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:46 -07:00 (1791082966)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The extension's per-entity activation routine (`ext.activate`, invoked by the host
 * as `ext.activate.for(id)`).
 *
 * @module api_test_live_suspended_caller.ext.activate
 */
import { self } from "@cldmv/slothlet/runtime";
import { afterGate, afterGateCaptured } from "./resume.mjs";
import { attempt } from "../../shared/attempt.mjs";

/**
 * Activate for one scenario. A plain function on purpose: the `sibling` scenario hands back a
 * promise created in a sibling file, so this file's frame is gone by the time that work resumes.
 * @param {string} scenario - Which activation to perform.
 * @param {Promise<void>} [gate] - Gate to wait on before acting.
 * @returns {Promise<*>} The activation's result.
 */
export function activate(scenario, gate) {
	if (scenario === "sibling") return afterGate(gate);
	if (scenario === "siblingCaptured") return afterGateCaptured(gate);
	if (scenario === "awaited") return awaitSibling(gate);
	if (scenario === "hold") return holdThenRender(gate);
	return registerThenSettle(scenario);
}

/**
 * Register a pinned render callback (for `pinned`), then settle.
 * @param {string} scenario - Activation scenario.
 * @returns {Promise<string>} `"activated"`.
 */
async function registerThenSettle(scenario) {
	if (scenario === "pinned") {
		self.registry.register(self.slothlet.lockCaller(() => attempt(() => self.ext.views.running.render("pinned"))));
		self.registry.register(
			self.slothlet.lockCaller(() =>
				attempt(
					() => self.ext.usage.cache.context.subscribe(() => {}),
					() => "subscribed"
				)
			)
		);
	}
	await null;
	return "activated";
}

/**
 * Await the sibling file's work from this file, so a frame of this file stays on the resumed stack.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<Array<string>>} The sibling's results.
 */
async function awaitSibling(gate) {
	return await afterGate(gate);
}

/**
 * Stay suspended on the gate, then reach the extension's own view from this file.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} The render result, or `"denied"`.
 */
async function holdThenRender(gate) {
	await gate;
	return attempt(() => self.ext.views.running.render("held"));
}
