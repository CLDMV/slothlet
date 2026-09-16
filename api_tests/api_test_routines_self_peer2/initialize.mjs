/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_self_peer2/initialize.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
