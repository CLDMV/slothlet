/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_self_peer2/initialize.mjs
 *	@Date: 2026-09-15T21:35:50-07:00 (1789533350)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:46-07:00 (1791090886)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The second of two independently-mounted contributors that stack at the same
 * composed path (mirrors the api_test_routines_auth1/auth2 pair, but reaching the coordinator via
 * ambient `self.coord.register(...)`). With `stackRoutines: true` the cascade must run both, each
 * with a live extent (#393).
 * @module api_test_routines_self_peer2.initialize
 * @memberof module:api_test_routines_self_peer2
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * @function initialize
 * @memberof module:api_test_routines_self_peer2
 * @returns {void}
 */
export default function initialize() {
	self.coord.register("peer2:init");
}
