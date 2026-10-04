/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_auth1/shutdown.mjs
 *	@Date: 2026-09-08T00:00:00-07:00 (1788850800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:01-07:00 (1791091681)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `shutdown`-mode routine contributor for `api_test_routines_auth1` (#341).
 * @module api_test_routines_auth1.shutdown
 * @memberof module:api_test_routines_auth1
 */

/**
 * @function shutdown
 * @memberof module:api_test_routines_auth1
 * @returns {void}
 */
export default function shutdown() {
	(globalThis.__slothletRoutineLog ??= []).push("auth1:shutdown");
}
