/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_scoped/admin/initialize.mjs
 *	@Date: 2026-09-09 00:00:00 -07:00 (1788886400)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-09 00:00:00 -07:00 (1788886400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A fixed dotted (`recursive: false`) routine contributor, one level below the
 * mount's own top level (#341) — used with `api_test_routines_scoped_other` (a separate mount) to
 * verify that materializing this fixed relative path never force-materializes an unrelated mount.
 * @module api_test_routines_scoped.admin.initialize
 * @memberof module:api_test_routines_scoped.admin
 */

/**
 * @function initialize
 * @memberof module:api_test_routines_scoped.admin
 * @returns {void}
 */
export default function initialize() {
	(globalThis.__slothletRoutineLog ??= []).push("scoped:admin:initialize");
}
