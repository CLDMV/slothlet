/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_nested/admin/shutdown.mjs
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
 * @fileoverview Nested `admin.shutdown` contributor, one level below the mount's own top level
 * (#341) — see `../shutdown.mjs`.
 * @module api_test_routines_nested.admin.shutdown
 * @memberof module:api_test_routines_nested.admin
 */

/**
 * @function shutdown
 * @memberof module:api_test_routines_nested.admin
 * @returns {void}
 */
export default function shutdown() {
	(globalThis.__slothletRoutineLog ??= []).push("nested:admin:shutdown");
}
