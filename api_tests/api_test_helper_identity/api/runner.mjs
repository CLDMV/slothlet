/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_identity/api/runner.mjs
 *	@Date: 2026-11-11T23:40:32-08:00 (1794469232)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:53:11-08:00 (1794469991)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that runs functions it is handed.
 * @module api_test_helper_identity.runner
 */

/**
 * Run a function and give back what it returns, or the code of the error it threw.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} Its result, or an error code.
 * @example
 * await api.runner.call(() => 1); // 1
 */
export const call = async (fn) => {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
};
