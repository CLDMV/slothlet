/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_prototype_crossings/reader/reader.mjs
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
 * @fileoverview Writes onto another module's class prototype however that module hands it over.
 * @module api_test_prototype_crossings/reader
 */

import { types } from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Write `key` onto a value, answering the outcome.
 * @param {function(): object} reach - Reaches the value.
 * @param {string} key - The member written.
 * @returns {string} `"written"`, or `"threw <code>"`.
 */
function write(reach, key) {
	try {
		reach()[key] = 1;
		return "written";
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Write onto the prototype carried by an error the owner throws.
 * @param {"self"|"local"} source - Where the owner reads the prototype.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeThrown(source, key) {
	try {
		self.owner.throwWith(source);
	} catch (error) {
		return write(() => error.p, key);
	}
	return "no throw";
}

/**
 * Write onto the prototype carried by an error the owner rejects with.
 * @param {"self"|"local"} source - Where the owner reads the prototype.
 * @param {string} key - The member written.
 * @returns {Promise<string>} The outcome.
 */
export async function writeRejected(source, key) {
	try {
		await self.owner.rejectWith(source);
	} catch (error) {
		return write(() => error.p, key);
	}
	return "no rejection";
}

/** The event the owner emits the prototype on. */
const CARRY = "prototype-crossings:carry";

/** Each listener's outcome, by the member it writes. */
const heard = new Map();

/** Each listener's unsubscribe, by the member it writes. */
const listening = new Map();

/**
 * Listen once on {@link CARRY}, writing `key` onto the payload when it is delivered.
 * @param {string} key - The member written.
 * @returns {string} The listener's id.
 */
export function listen(key) {
	heard.delete(key);
	const listener = (prototype) => {
		const outcome = write(() => prototype, key);
		heard.set(key, outcome);
	};
	const { off, id } = self.slothlet.event.on(CARRY, listener, { once: true, key });
	listening.set(key, off);
	return id;
}

/**
 * What the listener {@link listen} registered for `key` did, and drop the record.
 * @param {string} key - The member written.
 * @returns {string} The outcome, or `"not heard"`.
 */
export function heardOutcome(key) {
	const outcome = heard.get(key) ?? "not heard";
	heard.delete(key);
	listening.get(key)?.();
	listening.delete(key);
	return outcome;
}

/**
 * Write onto the prototype the owner emits through slothlet's event system to a listener of this module's.
 * @param {"self"|"local"} source - Where the owner reads the prototype.
 * @param {string} key - The member written.
 * @returns {Promise<string>} The outcome.
 */
export async function writeEmitted(source, key) {
	listen(key);
	await self.owner.emitWith(source);
	return heardOutcome(key);
}

/**
 * Write onto the prototype a `WeakRef` of the owner's holds.
 * @param {"self"|"local"} source - Where the owner reads the prototype.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeDereferenced(source, key) {
	return write(() => self.owner.weakRef(source).deref(), key);
}

/**
 * Write onto the prototype a frozen object of the owner's holds.
 * @param {"self"|"local"} source - Where the owner reads the prototype.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeFrozen(source, key) {
	return write(() => self.owner.frozenBox(source).p, key);
}

/**
 * Write onto the prototype the owner returns.
 * @param {"self"|"local"} source - Where the owner reads the prototype.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeReturned(source, key) {
	return write(() => self.owner.returnPrototype(source), key);
}

/**
 * Write onto the prototype read from the class's `prototype` descriptor.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeDescribed(key) {
	return write(() => Object.getOwnPropertyDescriptor(self.owner.Foo, "prototype").value, key);
}

/**
 * Write onto the prototype handed in nested in plain data.
 * @param {{inner: {p: object}}} box - The data.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeNested(box, key) {
	return write(() => box.inner.p, key);
}

/**
 * Write onto the prototype carried by the error an `owner.throwWith:error` hook of this module's is handed.
 * @param {"self"|"local"} source - Where the owner reads the prototype.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeHooked(source, key) {
	let outcome = "not hooked";
	// Each call registers its own hook, which writes once: hooks outlive a reload, and fire on every later failure.
	let heard = false;
	self.slothlet.hook.on(
		"owner.throwWith:error",
		({ error }) => {
			if (heard) return;
			heard = true;
			outcome = write(() => error.p, key);
		},
		{ id: `crossing-${key}` }
	);
	try {
		self.owner.throwWith(source);
	} catch {
		// The call's own failure; the hook reports what it saw.
	}
	return outcome;
}

/**
 * Write onto the prototype read through `self` at `name`.
 * @param {string} name - The export it is read through.
 * @param {string} key - The member written.
 * @returns {string} The outcome.
 */
export function writeThrough(name, key) {
	return write(() => self.owner[name].prototype, key);
}

/**
 * Whether reading the owner's prototype through `self` at `name` hands this module the object itself rather than a view.
 * @param {string} name - The export it is read through.
 * @returns {boolean} True for the object itself.
 */
export function holdsItself(name) {
	return !types.isProxy(self.owner[name].prototype);
}
