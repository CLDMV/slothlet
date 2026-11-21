/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_internal_helper/api/__door.mjs
 *	@Date: 2026-11-15T09:00:00-08:00 (1794762000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T09:00:00-08:00 (1794762000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file inside the module's folder that a leaf imports: it carries no instance tag in a browser.
 * @module api_test_browser_internal_helper.door
 */
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
 * Import one of slothlet's internal files by URL from `lib`, and use one of its exports.
 * @param {string} lib - The URL of slothlet's `lib/` folder as the page serves it.
 * @returns {Promise<string>} The outcome.
 * @example
 * await useInternal("/src/lib/"); // "MODULE_INTERNAL_NOT_IMPORTABLE"
 */
export async function useInternal(lib) {
	const context = await import(new URL("factories/context.mjs", lib).href);
	return outcome(() => context.getContextManager("live"));
}
