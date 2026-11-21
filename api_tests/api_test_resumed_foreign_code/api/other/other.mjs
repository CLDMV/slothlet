/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_resumed_foreign_code/api/other/other.mjs
 *	@Date: 2026-11-12T23:29:38-08:00 (1794554978)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:59:01-08:00 (1794556741)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that runs functions it is given and waits on promises it is given.
 * @module api_test_resumed_foreign_code.other
 * @memberof module:api_test_resumed_foreign_code
 */

/**
 * Run a function and wait for what it returns.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} What it resolved with, or the code of the error it threw.
 * @example
 * await api.other.call(async () => 1); // 1
 */
export const call = async (fn) => {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
};

/**
 * Wait for a promise the caller holds, so this call is waiting while the caller does something else.
 * @param {Promise<*>} gate - What to wait for.
 * @returns {Promise<string>} `"held"`.
 * @example
 * await api.other.hold(gate);
 */
export const hold = async (gate) => {
	await gate;
	return "held";
};
