/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_prototype_crossings/owner/owner.mjs
 *	@Date: 2026-11-08T10:28:06-08:00 (1794162486)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:11:39-08:00 (1794183099)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose class prototype it hands to another module by every route a value crosses between
 * modules: a thrown error, a rejection, an event payload, a `WeakRef`, a frozen object, an argument nested in plain data,
 * a return value, and a hook's error.
 * @module api_test_prototype_crossings/owner
 */

import { types } from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/** A class whose prototype is handed on. */
export class Foo {
	/** @returns {string} Marker. */
	hi() {
		return "foo";
	}
}

/** The same class under a second name. */
export { Foo as Alias };

/**
 * The prototype, as this module reads it through `self` or holds it in its own binding.
 * @param {"self"|"local"} source - Where it is read.
 * @returns {object} `Foo.prototype`.
 */
function pick(source) {
	return source === "local" ? Foo.prototype : self.owner.Foo.prototype;
}

/**
 * Throw an error carrying the prototype.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {never} Throws.
 */
export function throwWith(source) {
	const error = new Error("carrying");
	error.p = pick(source);
	throw error;
}

/**
 * Reject with an error carrying the prototype.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {Promise<never>} Rejects.
 */
export async function rejectWith(source) {
	const error = new Error("carrying");
	error.p = pick(source);
	throw error;
}

/** The event the prototype is emitted on. */
const CARRY = "prototype-crossings:carry";

/**
 * Emit the prototype through slothlet's event system, to every listener of {@link CARRY}.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {Promise<boolean>} True once the emit settled.
 */
export async function emitWith(source) {
	await self.slothlet.event.emit(CARRY, pick(source));
	return true;
}

/**
 * Whether a listener of this module's own hears the prototype it emits as the object itself.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {Promise<boolean>} True when the listener heard the very value emitted, and it is no view.
 */
export async function hearsOwnEmit(source) {
	const emitted = pick(source);
	let heard;
	const { off } = self.slothlet.event.on(CARRY, (payload) => {
		heard = payload;
	});
	try {
		await self.slothlet.event.emit(CARRY, emitted);
	} finally {
		off();
	}
	return heard === emitted;
}

/**
 * A `WeakRef` to the prototype.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {WeakRef<object>} The reference.
 */
export function weakRef(source) {
	return new WeakRef(pick(source));
}

/**
 * A frozen object holding the prototype.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {{p: object}} The object.
 */
export function frozenBox(source) {
	return Object.freeze({ p: pick(source) });
}

/**
 * Hand the prototype to the reader nested in plain data.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @param {string} key - The member the reader writes.
 * @returns {string} The reader's outcome.
 */
export function giveNested(source, key) {
	return self.reader.writeNested({ inner: { p: pick(source) } }, key);
}

/**
 * Hand the prototype to the reader inside a frozen object.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @param {string} key - The member the reader writes.
 * @returns {string} The reader's outcome.
 */
export function giveFrozen(source, key) {
	return self.reader.writeNested(Object.freeze({ inner: Object.freeze({ p: pick(source) }) }), key);
}

/**
 * The prototype, returned.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {object} `Foo.prototype`.
 */
export function returnPrototype(source) {
	return pick(source);
}

/**
 * The prototype, returned once a promise settles.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {Promise<object>} `Foo.prototype`.
 */
export async function returnPrototypeLater(source) {
	await null;
	return pick(source);
}

/**
 * Whether reading the prototype through `self` at `name` hands this module the object itself rather than a view.
 * @param {string} name - The export it is read through.
 * @returns {boolean} True for the object itself.
 */
export function holdsItself(name) {
	return !types.isProxy(self.owner[name].prototype);
}

/**
 * Write a member onto the prototype as read through `self` at `name`.
 * @param {string} name - The export it is read through.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeOwn(name, key) {
	try {
		self.owner[name].prototype[key] = 1;
		return "written";
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Whether the prototype holds `key` as its own, and drop it; `hi` is put back as it was.
 * @param {string} key - The member looked for.
 * @returns {boolean} Whether it held it.
 */
export function takeFromPrototype(key) {
	const held = Object.hasOwn(Foo.prototype, key) && (key !== "hi" || Foo.prototype.hi !== ORIGINAL_HI);
	if (key === "hi") Foo.prototype.hi = ORIGINAL_HI;
	else delete Foo.prototype[key];
	return held;
}

/** `Foo.prototype.hi` as the class defines it. */
const ORIGINAL_HI = Foo.prototype.hi;
