/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_nested/initialize.mjs
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
 * @fileoverview Mount-top-level `initialize` contributor (#341) — used alongside
 * `admin/initialize.mjs` to validate dotted (non-recursive) and recursive mount-relative matching.
 * @module api_test_routines_nested.initialize
 * @memberof module:api_test_routines_nested
 */

/**
 * @function initialize
 * @memberof module:api_test_routines_nested
 * @returns {void}
 */
export default function initialize() {
	(globalThis.__slothletRoutineLog ??= []).push("nested:top:initialize");
}
