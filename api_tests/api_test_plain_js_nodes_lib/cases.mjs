/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_js_nodes_lib/cases.mjs
 *	@Date: 2026-11-05T09:30:22-08:00 (1793899822)
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
 * @fileoverview Shared cases for the frozen and class node tests (#667). Each case runs on the owner module's api node
 * (read through `self` by another module, or by the host) and on a plain import of the same module, so the plain
 * value's answer is what the node's is checked against.
 * @module api_test_plain_js_nodes_lib/cases
 */

/**
 * Run `step`, answering what it returned or how it threw.
 * @param {Function} step - The step.
 * @returns {*} Its result, or `"threw <code or name>"`.
 */
export function attempt(step) {
	try {
		return step();
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * The reads whose answer depends on the frozen and class members' shapes.
 * @param {object} owner - The owner module: its api node, or its plain namespace.
 * @returns {object} What each read answered.
 */
export function reads(owner) {
	return {
		isFrozenList: attempt(() => Object.isFrozen(owner.frozenList)),
		subPrototype: attempt(() => Object.getPrototypeOf(owner.Sub) === owner.Base),
		subStatic: attempt(() => owner.Sub.kind()),
		descriptorValue: attempt(() => Object.getOwnPropertyDescriptor(owner.frozenBox, "inner").value === owner.frozenBox.inner),
		openDescriptorValue: attempt(() => Object.getOwnPropertyDescriptor(owner.shelf, "item").value === owner.shelf.item),
		instConstructor: attempt(() => owner.inst.constructor === owner.Foo),
		instConstructorName: attempt(() => owner.inst.constructor.name),
		instIsFoo: attempt(() => owner.inst instanceof owner.Foo),
		instPrototype: attempt(() => Object.getPrototypeOf(owner.inst) === owner.Foo.prototype),
		instProtoAccessor: attempt(() => owner.inst.__proto__ === owner.Foo.prototype),
		instConstructorPrototype: attempt(() => owner.inst.constructor.prototype === owner.Foo.prototype),
		instMethod: attempt(() => owner.inst.hi()),
		getterSibling: attempt(() => owner.withGetter.v),
		ownCheck: attempt(() => [{ tag: "own" } instanceof owner.OwnCheck, {} instanceof owner.OwnCheck]),
		inheritedCheck: attempt(() => [{ tag: "own" } instanceof owner.InheritedCheck, {} instanceof owner.InheritedCheck])
	};
}

/**
 * The reads of an object export its module froze when it loaded.
 * @param {object} owner - The owner module.
 * @returns {object} What each read answered.
 */
export function frozenAtLoad(owner) {
	return {
		isFrozen: attempt(() => Object.isFrozen(owner.frozenBox)),
		isSealed: attempt(() => Object.isSealed(owner.frozenBox)),
		isExtensible: attempt(() => Object.isExtensible(owner.frozenBox))
	};
}

/**
 * The owner's own writes to members it froze when it loaded, in strict mode as module code is.
 * @param {object} owner - The owner module.
 * @returns {object} The outcome of each.
 */
export function ownerWrites(owner) {
	return {
		addToDeepFrozen: attempt(() => {
			owner.frozenList[0].added = 1;
			return "added";
		}),
		writeFrozen: attempt(() => {
			owner.frozenBox.a = 2;
			return "written";
		}),
		value: owner.frozenBox.a
	};
}

/**
 * Freeze `later` as its owner does.
 * @param {object} owner - The owner module.
 * @returns {boolean} Whether it is frozen afterwards.
 */
export function freezeLater(owner) {
	Object.freeze(owner.later);
	return Object.isFrozen(owner.later);
}

/**
 * Freeze members that are already frozen: the array frozen when it loaded, and `later` once its owner froze it.
 * @param {object} owner - The owner module.
 * @returns {object} The outcome of each.
 */
export function refreeze(owner) {
	return {
		list: attempt(() => (Object.freeze(owner.frozenList), "done")),
		later: attempt(() => (Object.freeze(owner.later), "done")),
		laterFrozen: Object.isFrozen(owner.later)
	};
}

/**
 * Freeze the object export frozen when it loaded.
 * @param {object} owner - The owner module.
 * @returns {string} The outcome.
 */
export function refreezeAtLoad(owner) {
	return attempt(() => (Object.freeze(owner.frozenBox), "done"));
}
