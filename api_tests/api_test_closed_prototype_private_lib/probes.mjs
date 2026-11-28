/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_closed_prototype_private_lib/probes.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:45-08:00 (1795868865)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Probes run on a module's classes whose prototypes are closed (frozen, sealed, non-extensible) or open
 * and hold private (`_`) members: how the prototype lists, and what is read of its private members.
 * @module api_test_closed_prototype_private_lib/probes
 */

/** The classes the owner exports, by how each prototype is closed. */
export const CLASS_NAMES = ["FrozenBox", "SealedBox", "ClosedBox", "OpenBox"];

/**
 * Run `fn`, reporting its value or the error it threw.
 * @param {Function} fn - The access.
 * @returns {*} The value, or `"threw <code or name>"`.
 */
function attempt(fn) {
	try {
		return fn();
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * How a class's prototype and an instance of it list.
 * @param {object} namespace - Where the class is read from (`self.owner`, the api node, or a plain import).
 * @param {string} name - The class.
 * @returns {object} The answers.
 */
export function listing(namespace, name) {
	const proto = namespace[name].prototype;
	const inst = new namespace[name]();
	return {
		keys: attempt(() => Object.keys(proto)),
		names: attempt(() => Object.getOwnPropertyNames(proto).sort()),
		ownKeys: attempt(() => Reflect.ownKeys(proto).length),
		entries: attempt(() => Object.entries(proto).length),
		descriptors: attempt(() => Object.keys(Object.getOwnPropertyDescriptors(proto)).length),
		isFrozen: attempt(() => Object.isFrozen(proto)),
		isSealed: attempt(() => Object.isSealed(proto)),
		isExtensible: attempt(() => Object.isExtensible(proto)),
		forInInstance: attempt(() => {
			const found = [];
			for (const key in inst) found.push(key);
			return found;
		}),
		forInPrototype: attempt(() => {
			const found = [];
			for (const key in proto) found.push(key);
			return found;
		}),
		spread: attempt(() => Object.keys({ ...proto })),
		hi: attempt(() => inst.hi())
	};
}

/**
 * What is read of a class's private members, through its prototype and an instance.
 * @param {object} namespace - Where the class is read from.
 * @param {string} name - The class.
 * @returns {object} The answers.
 */
export function privacy(namespace, name) {
	const proto = namespace[name].prototype;
	const inst = new namespace[name]();
	const describe = (key) => {
		const descriptor = Object.getOwnPropertyDescriptor(proto, key);
		if (descriptor === undefined) return "none";
		return {
			enumerable: descriptor.enumerable,
			configurable: descriptor.configurable,
			writable: descriptor.writable,
			value: typeof descriptor.value,
			get: typeof descriptor.get
		};
	};
	return {
		read: attempt(() => typeof proto._hidden),
		call: attempt(() => inst._hidden()),
		inPrototype: attempt(() => "_hidden" in proto),
		inInstance: attempt(() => "_hidden" in inst),
		described: attempt(() => describe("_hidden")),
		describedCall: attempt(() => Object.getOwnPropertyDescriptor(proto, "_hidden").value.call(inst)),
		describedName: attempt(() => Object.getOwnPropertyDescriptor(proto, "_hidden").value.name),
		describedSame: attempt(
			() => Object.getOwnPropertyDescriptor(proto, "_hidden").value === Object.getOwnPropertyDescriptor(proto, "_hidden").value
		),
		accessor: attempt(() => inst._acc),
		accessorDescribed: attempt(() => describe("_acc")),
		accessorDescribedGet: attempt(() => Object.getOwnPropertyDescriptor(proto, "_acc").get.call(inst))
	};
}
