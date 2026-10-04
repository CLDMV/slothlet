/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_good/initialize.mjs
 *	@Date: 2026-09-08T00:00:00-07:00 (1788850800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:02-07:00 (1791091682)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A well-behaved routine contributor, mounted before `api_test_routines_bad` at the
 * same namespace, to prove a later contributor's throw doesn't retroactively undo an earlier
 * contributor's completed run (#341).
 * @module api_test_routines_good.initialize
 * @memberof module:api_test_routines_good
 */

/**
 * @function initialize
 * @memberof module:api_test_routines_good
 * @returns {void}
 */
export default function initialize() {
	(globalThis.__slothletRoutineLog ??= []).push("good");
}
