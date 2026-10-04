/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_teardown_once/base/shutdown.mjs
 *	@Date: 2026-10-02T10:18:15-07:00 (1790961495)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:46-07:00 (1791090886)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Root-level shutdown export of the base module (#542).
 * @module api_test_routines_teardown_once
 */

/**
 * Record that this teardown contribution ran.
 * @returns {string} Marker string.
 */
export function shutdown() {
	(globalThis.__slothletTeardownCalls ??= []).push("root.shutdown");
	return "root.shutdown";
}
