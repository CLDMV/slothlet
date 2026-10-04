/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped_other/ping.mjs
 *	@Date: 2026-09-09 00:00:00 -07:00 (1788937200)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:17 -07:00 (1791082997)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Ordinary sibling leaf at this unrelated mount's own top level, alongside the
 * `nested/` subfolder (#341) — keeps this mount's top level from solo-collapsing.
 * @module api_test_routines_scoped_other.ping
 * @memberof module:api_test_routines_scoped_other
 */

/**
 * @function ping
 * @memberof module:api_test_routines_scoped_other
 * @returns {string} `"pong"`.
 */
export default function ping() {
	return "pong";
}
