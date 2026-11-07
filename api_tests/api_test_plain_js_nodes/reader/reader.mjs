/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_js_nodes/reader/reader.mjs
 *	@Date: 2026-11-05T06:08:55-08:00 (1793887735)
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
 * @fileoverview Reads another module's frozen and class members through `self`, as plain JS reads them (#667).
 * @module api_test_plain_js_nodes/reader
 */

import { self } from "@cldmv/slothlet/runtime";
import {
	attempt,
	reads,
	frozenAtLoad,
	refreeze,
	refreezeAtLoad,
	heldReads,
	prototypeWrites,
	oddShapeReads,
	oddShapeWrites,
	chainReads,
	emitterPrototypes
} from "../../api_test_plain_js_nodes_lib/cases.mjs";

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
		hiddenPrototypeMethod: attempt(() => Object.getPrototypeOf(owner.hiddenInst).hi.call(owner.hiddenInst)),
		hiddenProtoAccessorMethod: attempt(() => owner.hiddenInst.__proto__.hi.call(owner.hiddenInst)),
		writeInstanceClassPrototype: attempt(() => {
			owner.inst.constructor.prototype.hi = () => "replaced";
			return "done";
		}),
		instIsFoo: attempt(() => owner.inst instanceof owner.Foo),
		inheritedCheck: attempt(() => ({ tag: "own" }) instanceof owner.InheritedCheck)
	};
}

/**
 * The reads of a class instance's prototype, made on nodes the host handed this module as arguments.
 * @param {object} inst - The owner's `inst` node.
 * @param {Function} Foo - The owner's `Foo` node.
 * @param {object} hiddenInst - The owner's `hiddenInst` node.
 * @returns {object} What each answered.
 */
export function readHeld(inst, Foo, hiddenInst) {
	return heldReads({ inst, Foo, hiddenInst });
}

/**
 * Write onto the prototype the owner's class instances answer, reached through `self`.
 * @param {string} key - The member written.
 * @returns {object} The outcome of each write.
 */
export function writePrototypes(key) {
	return prototypeWrites(self.owner, key);
}

/**
 * Write onto the prototype the owner's class instances answer, on nodes the host handed this module as arguments.
 * @param {object} inst - The owner's `inst` node.
 * @param {object} hiddenInst - The owner's `hiddenInst` node.
 * @param {string} key - The member written.
 * @returns {object} The outcome of each write.
 */
export function writeHeldPrototypes(inst, hiddenInst, key) {
	return prototypeWrites({ inst, hiddenInst }, key);
}

/**
 * Ask an instance whose prototype answers `constructor` through an accessor for its prototype, through `self`, as plain
 * JS asks it without running that accessor.
 * @returns {object} What each read answered.
 */
export function readAccessedPrototype() {
	const inst = self.owner.accessedInst;
	return {
		prototypeMethod: attempt(() => Object.getPrototypeOf(inst).hi.call(inst)),
		protoAccessorMethod: attempt(() => inst.__proto__.hi.call(inst))
	};
}

/**
 * Ask the owner's odd-shaped instances for their prototype through `self`.
 * @returns {object} What each read answered.
 */
export function readOddShapes() {
	return oddShapeReads(self.owner);
}

/**
 * Ask odd-shaped instance nodes the host handed this module for their prototype.
 * @param {object} held - The owner's odd-shaped instance nodes, by export name.
 * @returns {object} What each read answered.
 */
export function readHeldOddShapes(held) {
	return oddShapeReads(held);
}

/**
 * Write onto the odd-shaped instances' prototypes through `self`.
 * @param {string} key - The member written.
 * @returns {object} The outcome of each write.
 */
export function writeOddShapes(key) {
	return oddShapeWrites(self.owner, key);
}

/**
 * Write onto the prototypes of odd-shaped instance nodes the host handed this module.
 * @param {object} held - The owner's odd-shaped instance nodes, by export name.
 * @param {string} key - The member written.
 * @returns {object} The outcome of each write.
 */
export function writeHeldOddShapes(held, key) {
	return oddShapeWrites(held, key);
}

/**
 * Walk the owner's subclass instance's prototype chain through `self`.
 * @returns {object} What each read answered.
 */
export function readChain() {
	return chainReads(self.owner);
}

/**
 * Walk the prototype chain of a subclass instance node and a subclass node the host handed this module.
 * @param {object} subInst - The owner's `subInst` node.
 * @param {Function} FooSub - The owner's `FooSub` node.
 * @returns {object} What each read answered.
 */
export function readHeldChain(subInst, FooSub) {
	return chainReads({ subInst, FooSub });
}

/**
 * Ask the owner's emitter for its prototype through `self`, and write through it.
 * @param {string} key - The member written.
 * @returns {object} What each read and write answered.
 */
export function readEmitter(key) {
	return emitterPrototypes(self.owner.bus, key);
}

/**
 * Ask an emitter node the host handed this module for its prototype, and write through it.
 * @param {object} bus - The owner's `bus` node.
 * @param {string} key - The member written.
 * @returns {object} What each read and write answered.
 */
export function readHeldEmitter(bus, key) {
	return emitterPrototypes(bus, key);
}
