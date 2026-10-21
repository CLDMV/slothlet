/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_emitter_leak/net.mjs
 *	@Date: 2026-10-18T10:08:12-07:00 (1792343292)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T10:33:20-07:00 (1792344800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `fetch` made from inside a module (#611).
 */

/**
 * Fetch `url` and read the whole body.
 * @param {string} url - URL to fetch.
 * @returns {Promise<number>} The body length.
 */
export async function get(url) {
	return (await (await fetch(url)).text()).length;
}
