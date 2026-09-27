/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_self_peer/initialize.mjs
 *	@Date: 2026-09-15T21:35:50-07:00 (1789533350)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-26 22:31:22 -07:00 (1790487082)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A second `initialize` contributor mounted at `["worker"]` so it STACKS at the exact
 * same composed path (`self.worker.initialize`) as the base worker's `initialize` — with
 * `stackRoutines: true`, both must run under the cascade, and both reach the coordinator through
 * ambient `self.coord.register(...)`, proving the extent covers every contributor at a shared path
 * (#393).
 * @module api_test_routines_self_peer.initialize
 * @memberof module:api_test_routines_self_peer
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * @function initialize
 * @memberof module:api_test_routines_self_peer
 * @returns {void}
 */
export default function initialize() {
	self.coord.register("peer:init");
}
