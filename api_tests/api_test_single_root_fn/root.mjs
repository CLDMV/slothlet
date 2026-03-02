/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_single_root_fn/root.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:16 -08:00 (1772425276)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Single root function - acts as the callable API root.
 * @param {string} [input="world"] - Input string
 * @returns {string} Greeting
 */
export default function rootFn(input = "world") {
	return `root:${input}`;
}

export const version = "1.0";
