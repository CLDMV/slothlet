/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_rule_suffix/registrar/registrar.mjs
 *	@Date: 2026-11-18T21:49:06-08:00 (1795067346)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T21:57:55-08:00 (1795067875)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that registers a permission rule for its own subtree from its code.
 * @module api_test_rule_suffix/registrar
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Register a deny rule on a target in this module's own subtree.
 * @param {string} target - The rule target.
 * @returns {string} `"ok"`, or the error code it was refused with.
 * @example
 * add("registrar.secret:write"); // "ok"
 */
export function add(target) {
	try {
		self.slothlet.permissions.rules.add({ caller: "registrar.**", target, effect: "deny" });
		return "ok";
	} catch (error) {
		return error.code;
	}
}

/**
 * A member the rules target.
 * @returns {string} Marker.
 */
export function secret() {
	return "secret";
}
