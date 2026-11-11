/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_call_identity/helpers/board.mjs
 *	@Date: 2026-11-11T15:00:00-08:00 (1794438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T15:00:00-08:00 (1794438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for who makes each access of a member expression: a plain object two modules import, so one
 * can leave functions and values for the other by a route slothlet does not see.
 * @module api_test_self_call_identity.helpers.board
 */

/**
 * What the modules left for each other.
 * @type {Record<string, *>}
 */
export const board = {};

/**
 * Run code, reporting a refusal by its code.
 * @param {Function} fn - The code.
 * @returns {*} What it returned, or the code of what it threw.
 */
export const attempt = (fn) => {
	try {
		return fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
};
