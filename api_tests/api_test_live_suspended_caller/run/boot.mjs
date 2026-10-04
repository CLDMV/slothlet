/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/run/boot.mjs
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
 * @fileoverview Host boot step: activates one extension through its per-entity routine.
 *
 * @description
 * `run.*` may call the extension's routine and its public entry, but not the extension's own views,
 * so anything attributed to this leaf that reaches a view is denied.
 *
 * @module api_test_live_suspended_caller.run.boot
 */
import { self } from "@cldmv/slothlet/runtime";
import { attempt } from "../shared/attempt.mjs";

/**
 * Activate the extension, then act according to `scenario` from this host flow.
 * @param {string} scenario - Which follow-up to perform.
 * @param {string} id - Extension moduleID to activate via `ext.activate.for(id)`.
 * @param {Promise<void>} [gate] - Gate forwarded to the activation.
 * @returns {Promise<*>} The follow-up's result.
 */
export async function boot(scenario, id, gate) {
	const activation = await self.ext.activate.for(id)(scenario, gate);
	await null;
	// The extension's pinned render callback, invoked synchronously from this host flow.
	if (scenario === "pinned") return self.registry.renderAll();
	// A nested leaf of the extension, entered synchronously from this host flow.
	if (scenario === "nested") return attempt(() => self.ext.entry.start());
	// This leaf reaching the extension's view itself — the outer caller IS the right answer, and it is denied.
	if (scenario === "direct") return attempt(() => self.ext.views.running.render("direct"));
	// This leaf making a call it is permitted to make — the outer caller is right, and it is allowed.
	if (scenario === "own") return attempt(() => self.registry.list());
	return activation;
}
