/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_interleaved_run/m/m.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T08:00:00-08:00 (1794585600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose calls wait on a gate and then report the context they see.
 * @module api_test_live_interleaved_run.m
 * @memberof module:api_test_live_interleaved_run
 */
import { context } from "@cldmv/slothlet/runtime";

/**
 * Wait on a gate in the exported function, then report the context's tag.
 * @function slow
 * @memberof module:api_test_live_interleaved_run.m
 * @param {Promise<void>} [gate] - What to wait on; a macrotask when omitted.
 * @returns {Promise<string>} `"slow:<tag>"`.
 * @example
 * await api.m.slow(); // "slow:base"
 */
export async function slow(gate) {
	await (gate ?? new Promise((resolve) => setTimeout(resolve, 1)));
	return "slow:" + context.tag;
}

/**
 * Wait on a gate in an unnamed function nested in the export, then report the context's tag.
 * @function nested
 * @memberof module:api_test_live_interleaved_run.m
 * @param {Promise<void>} gate - What to wait on.
 * @returns {Promise<string>} `"nested:<tag>"`.
 * @example
 * await api.m.nested(Promise.resolve()); // "nested:base"
 */
export const nested = (gate) =>
	(async () => {
		await gate;
		return "nested:" + context.tag;
	})();

/**
 * Report the context's tag at once.
 * @function other
 * @memberof module:api_test_live_interleaved_run.m
 * @returns {string} `"other:<tag>"`.
 * @example
 * api.m.other(); // "other:base"
 */
export function other() {
	return "other:" + context.tag;
}
