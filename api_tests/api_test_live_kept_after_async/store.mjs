/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_after_async/store.mjs
 *	@Date: 2026-10-24T21:58:58-07:00 (1792904338)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T01:33:16-07:00 (1792917196)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module holding data and an async function another module keeps.
 */

/** @type {{n: number}} Data another module keeps a reference to. */
export const obj = { n: 1 };

/**
 * An async function another module keeps and calls later.
 * @returns {Promise<string>} "W".
 */
export async function work() {
	return "W";
}

/** @type {Function|null} Code another module asked to run whenever `box.evil` is read. */
let onRead = null;

/** @type {{inner: {v: number}, secret: number, evil: string}} An object one module may read all of and another not its `secret`. */
export const box = {
	inner: { v: 2 },
	secret: 42,
	get evil() {
		if (onRead) onRead();
		return "e";
	}
};

/**
 * Run `hook` whenever `box.evil` is read.
 * @param {Function} hook - The hook.
 * @returns {string} "set".
 */
export function whenRead(hook) {
	onRead = hook;
	return "set";
}
