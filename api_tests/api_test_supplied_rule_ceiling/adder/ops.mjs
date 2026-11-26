/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_supplied_rule_ceiling/adder/ops.mjs
 *	@Date: 2026-11-25T01:38:18-08:00 (1795599498)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:06:03-08:00 (1795601163)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that adds a rule on its own subtree, itself or through code it hands `runner`.
 * @module api_test_supplied_rule_ceiling/adder/ops
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Add an allow rule for this module on `target`.
 * @param {string} target - The rule's target.
 * @returns {string} The rule's id, or the error code it was refused with.
 */
function addFor(target) {
	try {
		return self.slothlet.permissions.rules.add({ caller: "adder.**", target, effect: "allow" });
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Add the rule from this module's own code.
 * @param {string} target - The rule's target.
 * @returns {string} The rule's id, or the error code.
 */
export function direct(target) {
	return addFor(target);
}

/**
 * Add the rule from code handed to `runner`, which runs it inside its own call.
 * @param {string} target - The rule's target.
 * @returns {string} The rule's id, or the error code.
 */
export function viaRunner(target) {
	return self.runner.ops.run(() => addFor(target));
}
