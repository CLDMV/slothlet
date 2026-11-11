/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/reader/reader.mjs
 *	@Date: 2026-11-11T10:00:39-08:00 (1794420039)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T10:13:03-08:00 (1794420783)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Two functions of one module reading the same value of another module's: one a write rule names, one
 * it does not.
 * @module api_test_crossing_rules/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * What one function of this module gets of the owner's held object, and how a write onto its instance's prototype ends.
 * @param {string} key - The member to write.
 * @returns {{wrapped: boolean, isHeld: boolean, write: string}} What it got.
 */
function probe(key) {
	const value = self.owner.getHeld();
	let write;
	try {
		Object.getPrototypeOf(value.inst)[key] = () => "planted";
		write = "written";
	} catch (error) {
		write = error?.code ?? String(error);
	}
	return { wrapped: self.slothlet.wrapped(value), isHeld: self.owner.isHeld(value), write };
}

export const plain = (key) => probe(key);
export const writer = (key) => probe(key);

/** The owner's held object as this module was handed it, kept past the instance. */
let kept;

/** The prototype of the instance it holds, as this module read it while the instance was up. */
let keptPrototype;

/**
 * Keep the owner's held object.
 * @returns {boolean} Whether this module was handed a view of it.
 */
export function keep() {
	kept = self.owner.getHeld();
	keptPrototype = Object.getPrototypeOf(kept.inst);
	return self.slothlet.wrapped(kept);
}

/**
 * Try every write onto the owner's class through the object kept, and one onto its data.
 * @param {string} prefix - The prefix of the members written.
 * @returns {Object<string, string>} How each write ended.
 */
function writeThroughKept(prefix) {
	const attempt = (write) => {
		try {
			write();
			return "written";
		} catch (error) {
			return error?.code ?? String(error);
		}
	};
	const planted = () => "planted";
	return {
		getPrototypeOf: attempt(() => (Object.getPrototypeOf(kept.inst)[`${prefix}getPrototypeOf`] = planted)),
		proto: attempt(() => (kept.inst.__proto__[`${prefix}proto`] = planted)),
		constructor: attempt(() => (kept.inst.constructor.prototype[`${prefix}constructor`] = planted)),
		method: attempt(() => (Object.getPrototypeOf(kept.inst).hi = planted)),
		keptPrototype: attempt(() => (keptPrototype[`${prefix}keptPrototype`] = planted)),
		shadowed: attempt(() => (kept.inst.hi = planted)),
		data: attempt(() => (kept.n = 2))
	};
}

// What the test runs once the instance is gone: this module's own code, holding what it was handed.
globalThis.__crossingRulesReader = { writeThroughKept };
