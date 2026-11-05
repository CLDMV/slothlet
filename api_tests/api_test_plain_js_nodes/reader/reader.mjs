/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_js_nodes/reader/reader.mjs
 *	@Date: 2026-11-05T06:08:55-08:00 (1793887735)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-05T08:16:33-08:00 (1793895393)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads another module's frozen and class members through `self`, as plain JS reads them (#667).
 * @module api_test_plain_js_nodes/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run `step`, answering what it returned or how it threw.
 * @param {Function} step - The step.
 * @returns {*} Its result, or `"threw <name>"`.
 */
function attempt(step) {
	try {
		return step();
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Each read the issue lists, made through `self`.
 * @returns {object} What each answered.
 */
export function read() {
	const owner = self.owner;
	return {
		isFrozen: attempt(() => Object.isFrozen(owner.frozenBox)),
		isFrozenList: attempt(() => Object.isFrozen(owner.frozenList)),
		isExtensible: attempt(() => Object.isExtensible(owner.frozenBox)),
		subPrototype: attempt(() => Object.getPrototypeOf(owner.Sub) === owner.Base),
		subProtoAccessor: attempt(() => owner.Sub.__proto__ === owner.Base),
		inheritedStatic: attempt(() => owner.Sub.kind()),
		clone: attempt(() => structuredClone(owner.frozenBox)),
		descriptorValue: attempt(() => Object.getOwnPropertyDescriptor(owner.frozenBox, "inner").value === owner.frozenBox.inner),
		openDescriptorValue: attempt(() => Object.getOwnPropertyDescriptor(owner, "open").value === owner.open),
		instConstructor: attempt(() => owner.inst.constructor === owner.Foo),
		instConstructorName: attempt(() => owner.inst.constructor.name),
		instIsFoo: attempt(() => owner.inst instanceof owner.Foo),
		ownCheck: attempt(() => [{ tag: "own" } instanceof owner.OwnCheck, {} instanceof owner.OwnCheck]),
		inheritedCheck: attempt(() => [{ tag: "own" } instanceof owner.InheritedCheck, {} instanceof owner.InheritedCheck])
	};
}

/**
 * Changes plain JS refuses or a module may not make to another module's members, made through `self`.
 * @returns {object} The outcome of each.
 */
export function change() {
	const owner = self.owner;
	return {
		freezeOpen: attempt(() => (Object.freeze(owner.open), "ok")),
		redefineFrozen: attempt(() => (Object.defineProperty(owner.frozenBox, "a", { value: 2 }), "ok")),
		writeFrozen: attempt(() => {
			owner.frozenBox.a = 2;
			return "ok";
		}),
		frozenValue: owner.frozenBox.a,
		openFrozen: Object.isFrozen(owner.open)
	};
}

/**
 * Calls reached through a class's reported prototype and its inherited `Symbol.hasInstance`.
 * @returns {object} The outcome of each.
 */
export function callThrough() {
	const owner = self.owner;
	return {
		baseKind: attempt(() => Object.getPrototypeOf(owner.Sub).kind()),
		inheritedCheck: attempt(() => ({ tag: "own" }) instanceof owner.InheritedCheck)
	};
}

/**
 * Freeze the owner's already frozen objects through `self`.
 * @returns {string[]} The outcome of each freeze.
 */
export function refreeze() {
	return [
		attempt(() => (Object.freeze(self.owner.frozenBox), "ok")),
		attempt(() => (Object.freeze(self.owner.frozenList), "ok")),
		attempt(() => (Object.freeze(self.owner.later), "ok"))
	];
}
