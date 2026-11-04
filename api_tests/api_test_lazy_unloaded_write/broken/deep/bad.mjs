/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/broken/deep/bad.mjs
 *	@Date: 2026-11-03T08:00:39-08:00 (1793721639)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T08:38:45-08:00 (1793723925)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that fails to load while the test asks it to (#653), and loads as an empty module otherwise,
 * so the whole fixture still loads in the structure suites.
 */
if (globalThis[Symbol.for("slothlet.test.i653.break")]) throw new Error("broken on purpose");

/**
 * @returns {string} `"bad"`.
 * @example
 * ok(); // "bad"
 */
export function ok() {
	return "bad";
}
