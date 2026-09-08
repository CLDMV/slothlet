/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_manual/launch.mjs
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
 * @fileoverview A custom, non-default `"manual"`-mode routine contributor (#341) — must never
 * auto-run; only `self.launch()` / `api.slothlet.launch()` invoke it.
 * @module api_test_routines_manual.launch
 * @memberof module:api_test_routines_manual
 */

/**
 * @function launch
 * @memberof module:api_test_routines_manual
 * @returns {void}
 */
export default function launch() {
	(globalThis.__slothletRoutineLog ??= []).push("manual:launch");
}
