/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_nested/shutdown.mjs
 *	@Date: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Mount-top-level `shutdown` contributor (#341) — used alongside
 * `admin/shutdown.mjs` to validate that `recursive: true` does not get double-invoked when the
 * legacy `collectLifecycleHooks` opt-in ALSO independently discovers the same literally-named
 * leaves via its own whole-tree walk.
 * @module api_test_routines_nested.shutdown
 * @memberof module:api_test_routines_nested
 */

/**
 * @function shutdown
 * @memberof module:api_test_routines_nested
 * @returns {void}
 */
export default function shutdown() {
	(globalThis.__slothletRoutineLog ??= []).push("nested:top:shutdown");
}
