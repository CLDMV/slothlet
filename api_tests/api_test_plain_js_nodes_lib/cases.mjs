/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_js_nodes_lib/cases.mjs
 *	@Date: 2026-11-05T09:30:22-08:00 (1793899822)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-07T00:48:53-08:00 (1794041333)
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

import util from "node:util";

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
		hiddenPrototype: attempt(() => Object.getPrototypeOf(owner.hiddenInst) === owner.hiddenInst.constructor.prototype),
		hiddenProtoAccessor: attempt(() => owner.hiddenInst.__proto__ === owner.hiddenInst.constructor.prototype),
		hiddenProtoAccessorPrototype: attempt(() => owner.hiddenInst.__proto__ === Object.getPrototypeOf(owner.hiddenInst)),
		hiddenPrototypeIsObject: attempt(() => Object.getPrototypeOf(owner.hiddenInst) === Object.prototype),
		hiddenPrototypeMethod: attempt(() => Object.getPrototypeOf(owner.hiddenInst).hi.call(owner.hiddenInst)),
		hiddenIsInstance: attempt(() => owner.hiddenInst instanceof owner.hiddenInst.constructor),
		hiddenConstructorName: attempt(() => owner.hiddenInst.constructor.name),
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

/**
 * The reads of a class instance's prototype made on nodes a module holds directly, handed to it as arguments rather
 * than read through `self` (#667).
 * @param {{inst: object, Foo: Function, hiddenInst: object}} held - The owner's `inst`, `Foo` and `hiddenInst`.
 * @returns {object} What each read answered.
 */
export function heldReads(held) {
	return {
		instPrototype: attempt(() => Object.getPrototypeOf(held.inst) === held.Foo.prototype),
		instPrototypeMethod: attempt(() => Object.getPrototypeOf(held.inst).hi.call(held.inst)),
		instProtoAccessorMethod: attempt(() => held.inst.__proto__.hi.call(held.inst)),
		instMethod: attempt(() => held.inst.hi()),
		instIsFoo: attempt(() => held.inst instanceof held.Foo),
		hiddenPrototype: attempt(() => Object.getPrototypeOf(held.hiddenInst) === held.hiddenInst.constructor.prototype),
		hiddenPrototypeMethod: attempt(() => Object.getPrototypeOf(held.hiddenInst).hi.call(held.hiddenInst)),
		hiddenProtoAccessorMethod: attempt(() => held.hiddenInst.__proto__.hi.call(held.hiddenInst)),
		hiddenMethod: attempt(() => held.hiddenInst.hi())
	};
}

/**
 * Write a member onto the prototype a class instance answers, by `Object.getPrototypeOf` and through `__proto__`
 * (#667), then report whether the write reached the realm's own `Object.prototype`.
 * @param {{inst: object, hiddenInst: object}} owner - The owner's `inst` and `hiddenInst`, however they were reached.
 * @param {string} key - The member written, a name no other code uses.
 * @returns {object} The outcome of each write, and whether `Object.prototype` holds the member afterwards.
 */
export function prototypeWrites(owner, key) {
	const write = (target) =>
		attempt(() => {
			target()[key] = 1;
			return "written";
		});
	return {
		instPrototype: write(() => Object.getPrototypeOf(owner.inst)),
		instProtoAccessor: write(() => owner.inst.__proto__),
		hiddenPrototype: write(() => Object.getPrototypeOf(owner.hiddenInst)),
		hiddenProtoAccessor: write(() => owner.hiddenInst.__proto__),
		reachedObjectPrototype: Object.hasOwn(Object.prototype, key)
	};
}

/** The instances whose class cannot be told from descriptors alone, each with a `hi()` method on its prototype. */
export const ODD_SHAPES = ["accessedInst", "ownConstructorInst", "bareInst", "proxiedInst"];

/**
 * Ask each odd-shaped instance for its prototype every way plain JS offers (#667): `Object.getPrototypeOf`,
 * `Reflect.getPrototypeOf` and `__proto__`, then whether `__proto__` became a member of its own.
 * @param {object} owner - The owner's instances: its api node, its plain namespace, or nodes handed over.
 * @returns {object} What each read answered, per instance.
 */
export function oddShapeReads(owner) {
	const out = {};
	for (const name of ODD_SHAPES) {
		const inst = owner[name];
		out[name] = {
			prototypeMethod: attempt(() => Object.getPrototypeOf(inst).hi.call(inst)),
			reflectPrototypeMethod: attempt(() => Reflect.getPrototypeOf(inst).hi.call(inst)),
			protoAccessorMethod: attempt(() => inst.__proto__.hi.call(inst)),
			pathsAgree: attempt(
				() => inst.__proto__ === Object.getPrototypeOf(inst) && Reflect.getPrototypeOf(inst) === Object.getPrototypeOf(inst)
			),
			method: attempt(() => inst.hi()),
			constructorName: attempt(() => (typeof inst.constructor === "function" ? inst.constructor.name : typeof inst.constructor)),
			ownProtoKey: attempt(() => {
				void inst.__proto__;
				return (
					Object.hasOwn(inst, "__proto__") ||
					Reflect.ownKeys(inst).includes("__proto__") ||
					Object.getOwnPropertyDescriptor(inst, "__proto__") !== undefined ||
					Reflect.ownKeys(Object.getOwnPropertyDescriptors(inst)).includes("__proto__")
				);
			}),
			inspectShowsProto: attempt(() => util.inspect(inst, { showHidden: true }).includes("__proto__"))
		};
	}
	return out;
}

/**
 * Write a member onto each odd-shaped instance's prototype, by `Object.getPrototypeOf` and through `__proto__`.
 * @param {object} owner - The owner's instances, however they were reached.
 * @param {string} key - The member written, a name no other code uses.
 * @returns {object} The outcome of each write, per instance and path.
 */
export function oddShapeWrites(owner, key) {
	const out = {};
	for (const name of ODD_SHAPES) {
		const inst = owner[name];
		out[name] = {
			prototype: attempt(() => {
				Object.getPrototypeOf(inst)[`${key}Get`] = 1;
				return "written";
			}),
			protoAccessor: attempt(() => {
				inst.__proto__[`${key}Proto`] = 1;
				return "written";
			})
		};
	}
	return out;
}

/**
 * Walk a subclass instance's and a subclass's prototype chain two levels up, to the base class's prototype (#667).
 * @param {{subInst: object, FooSub: Function}} owner - The owner's `subInst` and `FooSub`, however they were reached.
 * @returns {object} What each read answered.
 */
export function chainReads(owner) {
	const { subInst, FooSub } = owner;
	return {
		subMethod: attempt(() => Object.getPrototypeOf(subInst).sub.call(subInst)),
		baseByPrototypeOf: attempt(() => Object.getPrototypeOf(Object.getPrototypeOf(subInst)).hi.call(subInst)),
		baseByReflect: attempt(() => Reflect.getPrototypeOf(Reflect.getPrototypeOf(subInst)).hi.call(subInst)),
		baseByProtoAccessor: attempt(() => subInst.__proto__.__proto__.hi.call(subInst)),
		baseByMixed: attempt(() => Object.getPrototypeOf(subInst.__proto__).hi.call(subInst)),
		baseOfClassPrototype: attempt(() => Object.getPrototypeOf(FooSub.prototype).hi.call(subInst)),
		baseOfClassPrototypeAccessor: attempt(() => FooSub.prototype.__proto__.hi.call(subInst)),
		baseClassPrototype: attempt(() => Object.getPrototypeOf(FooSub).prototype.hi.call(subInst)),
		inheritedMethod: attempt(() => subInst.hi())
	};
}

/**
 * Ask an emitter of a class of its module's for its prototype, then write through what each path answers (#667).
 * @param {object} bus - The owner's emitter, however it was reached.
 * @param {string} key - The member written, a name no other code uses.
 * @returns {object} What each read and write answered.
 */
export function emitterPrototypes(bus, key) {
	return {
		pathsAgree: attempt(() => bus.__proto__ === Object.getPrototypeOf(bus) && Reflect.getPrototypeOf(bus) === Object.getPrototypeOf(bus)),
		prototypeName: attempt(() => Object.getPrototypeOf(bus).constructor.name),
		protoAccessorName: attempt(() => bus.__proto__.constructor.name),
		writePrototype: attempt(() => {
			Object.getPrototypeOf(bus)[key] = 1;
			return "written";
		}),
		writeProtoAccessor: attempt(() => {
			bus.__proto__[key] = 1;
			return "written";
		})
	};
}
