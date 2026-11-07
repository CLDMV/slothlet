/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/slow/hold/wait.mjs
 *	@Date: 2026-11-04T01:14:02-08:00 (1793783642)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T01:50:44-08:00 (1793785844)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose load waits for the test to let it finish (#653), and loads at once otherwise.
 */
await globalThis[Symbol.for("slothlet.test.i653.gate")];

/**
 * @returns {string} `"waited"`.
 * @example
 * waited(); // "waited"
 */
export function waited() {
	return "waited";
}
