/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_teardown_once/base/ping.mjs
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
 * @fileoverview Ordinary base leaf (#542).
 * @module api_test_routines_teardown_once
 */

/**
 * Plain leaf.
 * @returns {string} Marker string.
 */
export function ping() {
	return "pong";
}
