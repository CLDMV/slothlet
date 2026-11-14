/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stack_settings/api/good/good.mjs
 *	@Date: 2026-11-14T12:00:00-08:00 (1794686400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T12:00:00-08:00 (1794686400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The module allowed both nodes: it runs functions other modules hand it.
 * @module api_test_stack_settings.good
 * @memberof module:api_test_stack_settings
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the node only this module may call.
 * @returns {string} Its value.
 */
export function readOnly() {
	return self.only.get();
}

/**
 * Run a function after an `await`.
 * @param {function(): unknown} fn - The function.
 * @returns {Promise<unknown>} What it returns.
 */
export async function runIt(fn) {
	await null;
	return fn();
}

/**
 * Run a function at once.
 * @param {function(): unknown} fn - The function.
 * @returns {unknown} What it returns.
 */
export function runItSync(fn) {
	return fn();
}
