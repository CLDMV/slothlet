/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_gaps/base/store.mjs
 *	@Date: 2026-10-25T09:23:42-07:00 (1792945422)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T11:37:46-07:00 (1792953466)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): data, a function and an async function another module keeps.
 */

/** @type {{n: number, inner: {x: number}}} Data another module keeps a reference to. */
export const obj = { n: 1, inner: { x: 2 } };

/** @type {ReadonlyArray<*>} A frozen array another module keeps a reference to. */
export const farr = Object.freeze([1, Object.freeze({ v: 2 })]);

/**
 * An async function another module keeps and calls later.
 * @returns {Promise<string>} "W".
 */
export async function work() {
	return "W";
}
