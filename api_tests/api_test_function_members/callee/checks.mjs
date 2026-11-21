/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members/callee/checks.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T00:00:00-08:00 (1793692800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — code of the callee's own testing its emitter node against the emitter's class.
 *
 * @module api_tests/api_test_function_members/callee/checks
 */

import { self } from "@cldmv/slothlet/runtime";
import { Bus } from "../../api_test_function_members_lib/bus-class.mjs";

/**
 * Whether the callee's emitter node is an instance of its class, with that class's prototype as its own.
 * @returns {boolean[]} `[instanceof Bus, getPrototypeOf === Bus.prototype]`.
 * @public
 * @example
 * owner(); // [true, true]
 */
export function owner() {
	return [self.callee.bus instanceof Bus, Object.getPrototypeOf(self.callee.bus) === Bus.prototype];
}
