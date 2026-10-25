/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_lazy_waiting/store/sub/sub.mjs
 *	@Date: 2026-10-25T02:50:59-07:00 (1792921859)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T03:12:48-07:00 (1792923168)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a value one module may not read, and a getter that runs code another module asked
 * to run.
 */

/** @type {number} A value one module may not read. */
export const secret = 99;

/** @type {Function|null} Code another module asked to run whenever `box.evil` is read. */
let onRead = null;

/**
 * Run `hook` whenever `box.evil` is read.
 * @param {Function} hook - The hook.
 * @returns {string} "set".
 */
export function whenRead(hook) {
	onRead = hook;
	return "set";
}

/** @type {{evil: string}} An object whose getter runs that code. */
export const box = {
	get evil() {
		if (onRead) onRead();
		return "e";
	}
};
