/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_uwa_made_other/api/other.mjs
 *	@Date: 2026-11-25T01:53:25-08:00 (1795600405)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:07:59-08:00 (1795601279)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second module, handed values another module made.
 */

/**
 * Await a promise handed in and read what it settles to.
 * @param {Promise<{n: number}>} pending - The promise.
 * @returns {Promise<number>} Its `n`.
 * @example
 * await awaitIt(Promise.resolve({ n: 1 }));
 */
export async function awaitIt(pending) {
	const settled = await pending;
	return settled.n;
}

/**
 * Await a promise handed in that rejects, and report what it rejected with.
 * @param {Promise<*>} pending - The promise.
 * @returns {Promise<string>} The rejection's message.
 * @example
 * await reasonOf(Promise.reject(new Error("x")));
 */
export async function reasonOf(pending) {
	try {
		await pending;
		return "settled";
	} catch (error) {
		return error.message;
	}
}
