/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_interleaved_run/n/n.mjs
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
 * @fileoverview A second module whose call waits on a gate and then reports the context it sees.
 * @module api_test_live_interleaved_run.n
 * @memberof module:api_test_live_interleaved_run
 */
import { context } from "@cldmv/slothlet/runtime";

/**
 * Wait on a gate in the exported function, then report the context's tag.
 * @function slow
 * @memberof module:api_test_live_interleaved_run.n
 * @param {Promise<void>} gate - What to wait on.
 * @returns {Promise<string>} `"n:<tag>"`.
 * @example
 * await api.n.slow(Promise.resolve()); // "n:base"
 */
export async function slow(gate) {
	await gate;
	return "n:" + context.tag;
}
