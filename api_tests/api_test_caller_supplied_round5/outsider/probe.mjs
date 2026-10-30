/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/outsider/probe.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module no rule lets call the callee (#597): reading the callee's exported getter is refused to it,
 * as calling the callee's function through `self` would be.
 *
 * @module api_tests/api_test_caller_supplied_round5/outsider/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the callee's exported getter.
 * @returns {string} What it returned, or the refusal's code.
 * @public
 * @example
 * api.outsider.probe.readHeld(); // "PERMISSION_DENIED"
 */
export function readHeld() {
	try {
		return self.callee.box.held.value;
	} catch (error) {
		return error?.code ?? String(error);
	}
}
