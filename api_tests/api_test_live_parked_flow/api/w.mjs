/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_parked_flow/api/w.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T08:00:00-08:00 (1794672000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that awaits what it is given.
 * @module api_test_live_parked_flow.w
 */

/**
 * Await a promise, reporting a refusal by its code.
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
