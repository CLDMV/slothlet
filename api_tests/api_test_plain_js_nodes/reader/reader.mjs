/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_js_nodes/reader/reader.mjs
 *	@Date: 2026-11-05T06:08:55-08:00 (1793887735)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T10:26:36-08:00 (1793903196)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads another module's frozen and class members through `self`, as plain JS reads them (#667).
 * @module api_test_plain_js_nodes/reader
 */

import { self } from "@cldmv/slothlet/runtime";
import { attempt, reads, frozenAtLoad, refreeze, refreezeAtLoad } from "../../api_test_plain_js_nodes_lib/cases.mjs";

/**
 * The reads, made through `self`.
 * @returns {object} What each answered.
 */
export function read() {
	return reads(self.owner);
}

/**
 * The reads of the object export frozen when it loaded, made through `self`.
 * @returns {object} What each answered.
 */
export function readFrozenAtLoad() {
	return frozenAtLoad(self.owner);
}

/**
 * Freeze the owner's already frozen members through `self`.
 * @returns {object} The outcome of each.
 */
export function refreezeOwner() {
	return refreeze(self.owner);
}

/**
 * Freeze the owner's object export frozen when it loaded, through `self`.
 * @returns {string} The outcome.
 */
export function refreezeOwnerAtLoad() {
	return refreezeAtLoad(self.owner);
}

/**
 * Changes a module may not make to another module's members, made through `self`.
 * @returns {object} The outcome of each.
 */
export function change() {
	const owner = self.owner;
	return {
		freezeOpen: attempt(() => (Object.freeze(owner.open), "done")),
		writeOpen: attempt(() => {
			owner.open.o = 2;
			return "done";
		}),
		openValue: owner.open.o,
		openFrozen: Object.isFrozen(owner.open)
	};
}

/**
 * Calls reached through a class's reported prototype, an instance's class, and an inherited `Symbol.hasInstance`.
 * @returns {object} The outcome of each.
 */
export function callThrough() {
	const owner = self.owner;
	return {
		baseKind: attempt(() => Object.getPrototypeOf(owner.Sub).kind()),
		classMethod: attempt(() => owner.Foo.prototype.hi.call(owner.inst)),
		instanceClassMethod: attempt(() => owner.inst.constructor.prototype.hi.call(owner.inst)),
		instancePrototypeMethod: attempt(() => Object.getPrototypeOf(owner.inst).hi.call(owner.inst)),
		writeInstanceClassPrototype: attempt(() => {
			owner.inst.constructor.prototype.hi = () => "replaced";
			return "done";
		}),
		instIsFoo: attempt(() => owner.inst instanceof owner.Foo),
		inheritedCheck: attempt(() => ({ tag: "own" }) instanceof owner.InheritedCheck)
	};
}
