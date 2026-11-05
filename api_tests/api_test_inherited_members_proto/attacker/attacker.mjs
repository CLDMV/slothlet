/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inherited_members_proto/attacker/attacker.mjs
 *	@Date: 2026-11-04T22:51:34-08:00 (1793861494)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:52:46-08:00 (1793861566)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module the rules deny access to `victim` (#630): it reaches the victim's prototypes through
 * `__proto__` and `constructor` on its api nodes.
 * @module api_test_inherited_members_proto/attacker/attacker
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a step, reporting what it gave or the error code it threw.
 * @param {Function} step - The step.
 * @returns {*} Its result, or `threw <code>`.
 */
function attempt(step) {
	try {
		const result = step();
		return typeof result === "function" ? "function" : result;
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Try every way through `__proto__` and `constructor` into the victim's prototypes.
 * @returns {Object<string, *>} Each attempt's outcome.
 */
export function run() {
	return {
		readProtoMember: attempt(() => self.victim.inst.__proto__.secret),
		callProtoMember: attempt(() => self.victim.inst.__proto__.secret()),
		assignProtoMember: attempt(() => {
			self.victim.inst.__proto__.secret = () => "replaced";
			return "assigned";
		}),
		defineProtoMember: attempt(() => {
			Object.defineProperty(self.victim.inst.__proto__, "added", { value: 1, configurable: true });
			return "defined";
		}),
		readConstructorPrototype: attempt(() => typeof self.victim.inst.constructor.prototype.secret),
		assignBaseStatic: attempt(() => {
			self.victim.Derived.__proto__.added = 1;
			return "assigned";
		}),
		callBaseStatic: attempt(() => self.victim.Derived.__proto__.kind())
	};
}
