/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round9/ticker/ticker.mjs
 *	@Date: 2026-10-18T12:42:13-07:00 (1792352533)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T12:52:02-07:00 (1792353122)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose timer callbacks return promises already settled whose state the inspector cannot read
 * without running code of theirs (#597).
 *
 * @module api_tests/api_test_caller_supplied_round9/ticker/ticker
 */

/**
 * A settled promise of a kind whose state cannot be read without running code of its own.
 * @param {"meta"|"cancel"} kind - One carrying an object of its own, or a method of its own.
 * @returns {Promise<number>} The promise.
 * @private
 */
function unreadable(kind) {
	if (kind === "cancel") return Object.assign(Promise.resolve(1), { cancel() {} });
	return Object.assign(Promise.resolve(1), { meta: {} });
}

/**
 * Schedule `count` timers, each of whose callbacks returns a settled promise of a kind.
 * @param {number} count - How many timers.
 * @param {"meta"|"cancel"} kind - The promises' kind.
 * @returns {Promise<number>} Resolves with the count once every callback has run.
 * @public
 * @example
 * await api.ticker.ticks(100, "meta"); // 100
 */
export function ticks(count, kind) {
	return new Promise((resolve) => {
		let ran = 0;
		for (let index = 0; index < count; index++) {
			setTimeout(() => {
				ran++;
				if (ran === count) setTimeout(() => resolve(count), 0);
				return unreadable(kind);
			}, 0);
		}
	});
}
