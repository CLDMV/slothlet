/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/api/callee/callee.mjs
 *	@Date: 2026-11-06T19:31:26-08:00 (1794022286)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T19:39:55-08:00 (1794022795)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that is handed a function by another module and runs it later from a call of its own (#714):
 * the function's code is the other module's, so it runs as that module, under this module's call.
 * @module api_test_vite_late_files.callee
 */
import { self } from "@cldmv/slothlet/runtime";

let handed = null;

/**
 * Keep a function another module hands over.
 * @param {Function} fn - The function.
 * @returns {boolean} True.
 */
export function hand(fn) {
	handed = fn;
	return true;
}

/**
 * Run the function kept by {@link hand}.
 * @returns {Promise<unknown>} What it gives.
 */
export async function fire() {
	return handed();
}

/**
 * Report who called it.
 * @returns {string|null} The caller's api path.
 */
export function gated() {
	return self.slothlet.metadata.caller()?.apiPath ?? null;
}
