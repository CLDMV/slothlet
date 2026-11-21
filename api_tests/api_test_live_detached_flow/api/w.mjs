/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_detached_flow/api/w.mjs
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
 * @fileoverview A module that awaits what it is given, and one that waits on a gate.
 * @module api_test_live_detached_flow.w
 * @memberof module:api_test_live_detached_flow
 */

/**
 * Await a promise, reporting a refusal by its code.
 * @function wait
 * @memberof module:api_test_live_detached_flow.w
 * @param {Promise<*>} promise - The promise.
 * @returns {Promise<*>} What it resolved to, or the code of the error it rejected with.
 * @example
 * await api.w.wait(Promise.resolve(1)); // 1
 */
export const wait = async (promise) => {
	try {
		return await promise;
	} catch (error) {
		return error.code ?? error.name;
	}
};

/**
 * Wait on a gate.
 * @function hold
 * @memberof module:api_test_live_detached_flow.w
 * @param {Promise<void>} gate - The gate.
 * @returns {Promise<string>} "held"
 * @example
 * await api.w.hold(Promise.resolve()); // "held"
 */
export const hold = async (gate) => {
	await gate;
	return "held";
};
