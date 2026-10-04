/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_teardown_once/base/destroy.mjs
 *	@Date: 2026-10-02T10:18:15-07:00 (1790961495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:04-07:00 (1791091684)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Root-level destroy export of the base module (#542).
 * @module api_test_routines_teardown_once
 */

/**
 * Record that this teardown contribution ran.
 * @returns {string} Marker string.
 */
export function destroy() {
	(globalThis.__slothletTeardownCalls ??= []).push("root.destroy");
	return "root.destroy";
}
