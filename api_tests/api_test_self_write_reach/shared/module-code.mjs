/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/shared/module-code.mjs
 *	@Date: 2026-10-18T20:47:59-07:00 (1792381679)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T21:34:52-07:00 (1792384492)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code the `vault-manager` fixture module runs through `self` (#625). A folder module with its own
 * `package.json` cannot reach `@cldmv/slothlet/runtime` by name, so its leaf calls into this file, which can.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Add a permission rule from the calling module's code.
 * @param {object} rule - The rule.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addRuleFor({ caller: "guest.**", target: "victim.**:write", effect: "allow" });
 */
export function addRuleFor(rule) {
	try {
		return self.slothlet.permissions.addRule(rule);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Call a member of the victim.
 * @returns {*} What it returned, or the error code the call was refused with.
 * @example
 * callVictim(); // 100
 */
export function callVictim() {
	try {
		return self.victim.v.balanceOfNew();
	} catch (error) {
		return error?.code ?? String(error);
	}
}
