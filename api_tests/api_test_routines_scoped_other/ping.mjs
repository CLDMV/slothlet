/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped_other/ping.mjs
 *	@Date: 2026-09-09T00:00:00-07:00 (1788937200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:03-07:00 (1791091683)
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
