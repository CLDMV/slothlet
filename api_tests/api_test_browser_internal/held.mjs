/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_internal/held.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794675600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A browser api leaf that imports slothlet's internal files by their URL (which a browser always serves)
 * and uses their exports: every use is refused.
 * @module api_test_browser_internal.held
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The code an attempt failed with, or `"used"` when it ran.
 * @param {function(): *} attempt - The attempt.
 * @returns {string} The outcome.
 */
function outcome(attempt) {
	try {
		attempt();
		return "used";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Import slothlet's internal files by URL from `lib`, and use their exports.
 * @param {string} lib - The URL of slothlet's `lib/` folder as the page serves it.
 * @returns {Promise<string>} The outcomes, comma-separated.
 */
export async function tryInternals(lib) {
	const placement = await import(new URL("handlers/frame-placement.mjs", lib).href);
	const wrapper = await import(new URL("handlers/unified-wrapper.mjs", lib).href);
	const context = await import(new URL("factories/context.mjs", lib).href);
	const imports = await import(new URL("helpers/instance-imports.mjs", lib).href);
	return [
		outcome(() => placement.enterCall()),
		outcome(() => placement.setApiValueCheck(() => true)),
		outcome(() => wrapper.resolveWrapper(self.held)),
		outcome(() => new wrapper.UnifiedWrapper()),
		outcome(() => context.liveContextManager.instances),
		outcome(() => context.getContextManager("live")),
		outcome(() => imports.setCallerCheck(() => null)),
		outcome(() => placement.internals("lib/handlers/context-live"))
	].join(",");
}
