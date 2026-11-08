/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_prototype_crossings/owner/owner.mjs
 *	@Date: 2026-11-08T10:28:06-08:00 (1794162486)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T10:32:29-08:00 (1794162749)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose class prototype it hands to another module by every route a value crosses between
 * modules: a thrown error, a rejection, an event, a callback, a `WeakRef`, a frozen object, an argument nested in plain
 * data, and a hook's error.
 * @module api_test_prototype_crossings/owner
 */

import { EventEmitter } from "node:events";
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

/** An emitter another module listens on. */
export const bus = new EventEmitter();

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

/**
 * Emit the prototype on {@link bus}.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {boolean} Whether a listener heard it.
 */
export function emitWith(source) {
	return bus.emit("carry", pick(source));
}

/**
 * Call a function the caller handed in with the prototype.
 * @param {function(object): *} callback - The caller's function.
 * @param {"self"|"local"} source - Where the prototype is read.
 * @returns {*} What the callback returned.
 */
export function callBack(callback, source) {
	return callback(pick(source));
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
