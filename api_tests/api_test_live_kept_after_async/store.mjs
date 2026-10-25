/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_after_async/store.mjs
 *	@Date: 2026-10-24T21:58:58-07:00 (1792904338)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T22:00:12-07:00 (1792904412)
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
