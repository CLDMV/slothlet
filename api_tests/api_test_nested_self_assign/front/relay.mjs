/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/front/relay.mjs
 *	@Date: 2026-10-18T13:32:03-07:00 (1792355523)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T21:34:35-07:00 (1792384475)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "front" (moduleID "front") by the nested self-assign ownership tests (#625): a
// module calling into `evil`, so `evil` has a module caller while it runs.
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call `evil.x.keepCallerPin` and hand back what it returns.
 * @returns {Promise<Function>} The deferred pin-and-run `evil` handed back.
 */
export function keepCallerPin() {
	return self.evil.x.keepCallerPin();
}

/**
 * Add a permission rule from this module's code (#625).
 * @param {object} rule - The rule.
 * @returns {string} The rule's id, or the error code it was refused with.
 */
export function addRuleFor(rule) {
	try {
		return self.slothlet.permissions.addRule(rule);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Remove a permission rule from this module's code (#625).
 * @param {string} ruleId - The rule's id.
 * @returns {*} What `removeRule` returned, or the error code it was refused with.
 */
export function removeRuleFor(ruleId) {
	try {
		return self.slothlet.permissions.removeRule(ruleId);
	} catch (error) {
		return error?.code ?? String(error);
	}
}
