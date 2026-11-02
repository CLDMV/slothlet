/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_forged/base/victim/caller.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The victim for the forged-placement tests (#597): a module with rights the attacker lacks,
 * which calls the attacker's leaf and hands it a callback, as any caller passing an option or a callback does.
 *
 * @module api_tests/api_test_caller_supplied_forged/base/victim/caller
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call one of the attacker's leaves, handing it a callback.
 * @param {string} operation - The attacker leaf to call.
 * @returns {*} What it returned.
 * @public
 * @example
 * await api.victim.caller.callAttacker("subscribe");
 */
export function callAttacker(operation) {
	return self.attacker.leaf[operation](() => operation);
}

/**
 * Register a principal this module owns.
 * @returns {boolean} True once registered.
 * @public
 * @example
 * api.victim.caller.registerRoles(); // true
 */
export function registerRoles() {
	self.slothlet.permissions.principal.register("roles", { key: () => "k", resolve: () => ({ role: "victim" }) });
	return true;
}

/**
 * Whether this module's principal is still registered (invalidating its cache reports whether it exists).
 * @returns {boolean} True when the principal is registered.
 * @public
 * @example
 * api.victim.caller.hasRoles(); // true
 */
export function hasRoles() {
	return self.slothlet.permissions.principal.invalidate("roles");
}
