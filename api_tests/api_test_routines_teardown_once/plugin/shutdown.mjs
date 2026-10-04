/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_teardown_once/plugin/shutdown.mjs
 *	@Date: 2026-10-02 10:18:15 -07:00 (1790961495)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:20 -07:00 (1791083000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shutdown export at the top level of a mounted module, below the api root (#542).
 * @module api_test_routines_teardown_once
 */

/**
 * Record that this teardown contribution ran.
 * @returns {string} Marker string.
 */
export function shutdown() {
	(globalThis.__slothletTeardownCalls ??= []).push("plugin.shutdown");
	return "plugin.shutdown";
}
