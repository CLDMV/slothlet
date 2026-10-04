/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_self/worker.mjs
 *	@Date: 2026-09-15T21:35:50-07:00 (1789533350)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:18 -07:00 (1791082998)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A routine contributor whose `initialize`/`activate` bodies reach the coordinator
 * through AMBIENT `self.coord.register(...)`. Dereferencing `self` throws
 * RUNTIME_NO_ACTIVE_CONTEXT_SELF unless an instance extent is active when the routine runs — so this
 * exercises whether the ROOT CASCADE establishes that extent (#393).
 * @module api_test_routines_self.worker
 * @memberof module:api_test_routines_self
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * @function initialize
 * @memberof module:api_test_routines_self
 * @returns {void}
 */
export function initialize() {
	self.coord.register("worker:init");
}

/**
 * @function activate
 * @memberof module:api_test_routines_self
 * @param {{ id?: string|number }} [ctx] - Forwarded cascade argument, proving args reach contributors.
 * @returns {void}
 */
export function activate(ctx) {
	self.coord.register(`worker:activate:${ctx?.id ?? "?"}`);
}
