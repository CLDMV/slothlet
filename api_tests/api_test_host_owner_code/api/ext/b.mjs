/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/api/ext/b.mjs
 *	@Date: 2026-11-06T05:58:16-08:00 (1793973496)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T15:38:27-08:00 (1794008307)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module calling the host's own leaves and a hooked leaf of its own (#714). `work` hands the host's
 * record leaf a callback, as rummage's extensions do with `self.host.records.*`; the host's leaf then asks for a store
 * partition while its call holds the callback. `callHooked` calls `hooked`, which the host wraps in an `around` hook that pins each function
 * argument with `lockCaller`, as rummage's caller-callback hooks do.
 * @module api_test_host_owner_code.ext.b
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Hand the host's record leaf a callback.
 * @returns {Promise<string>} What the host's leaf gives.
 */
export async function work() {
	return self.host.records.apply(() => "callback");
}

/**
 * Call this module's hooked leaf with a function.
 * @returns {Promise<string>} What the hooked leaf gives.
 */
export async function callHooked() {
	return self.ext.b.hooked(() => "callback");
}

/**
 * Report the kind of what it was handed.
 * @param {unknown} value - What the hook passed on.
 * @returns {string} Its `typeof`.
 */
export function hooked(value) {
	return typeof value;
}
