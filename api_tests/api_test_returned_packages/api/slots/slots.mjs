/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_returned_packages/api/slots/slots.mjs
 *	@Date: 2026-10-27T07:00:18-07:00 (1793109618)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:29-08:00 (1795868969)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#597): objects whose behaviour lives in internal slots — a `Map`, an emitter, a `Date`, a
 * key — some carrying this module's own code, and Node's own such objects, handed out.
 * @module api_test_returned_packages.slots
 */
import { self } from "@cldmv/slothlet/runtime";
import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import vm from "node:vm";
import net from "node:net";
import { MIMEType } from "node:util";

/**
 * Read the vault's secret through `self`.
 * @returns {Promise<*>} The secret, or the error code its read was refused with.
 */
async function steal() {
	try {
		return await self.vault.secret;
	} catch (error) {
		return error.code ?? error.message;
	}
}

/** A `Map` whose class is this module's. */
class StealingMap extends Map {
	/** @returns {Promise<*>} The vault's secret, as whoever runs it. */
	steal() {
		return steal();
	}
}

/** An emitter whose class is this module's. */
class StealingEmitter extends EventEmitter {
	/** @returns {Promise<*>} The vault's secret, as whoever runs it. */
	steal() {
		return steal();
	}
}

/**
 * A `Map` of this module's own class.
 * @returns {Map} The map.
 */
export function map() {
	return new StealingMap();
}

/**
 * An emitter of this module's own class.
 * @returns {EventEmitter} The emitter.
 */
export function emitter() {
	return new StealingEmitter();
}

/**
 * A `Date` carrying a function of this module's.
 * @returns {Date} The date.
 */
export function date() {
	const value = new Date(0);
	value.steal = steal;
	return value;
}

/**
 * A plain `Map` and a plain emitter, holding only data.
 * @returns {{map: Map, emitter: EventEmitter}} The values.
 */
export function plain() {
	return { map: new Map([["a", 1]]), emitter: new EventEmitter() };
}

/**
 * Keys and a message channel, made by Node.
 * @returns {Promise<{secret: object, privateKey: object, cryptoKey: object, channel: MessageChannel}>} The values.
 */
export async function node() {
	const secret = crypto.createSecretKey(Buffer.alloc(16, 1));
	const { privateKey } = crypto.generateKeyPairSync("ed25519");
	const cryptoKey = await crypto.subtle.importKey("raw", Buffer.alloc(16, 1), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return { secret, privateKey, cryptoKey, channel: new MessageChannel() };
}

/**
 * This module's function, kept where only an engine method reaches it: in a `Map`, a `Set`, behind a promise (one
 * carrying a member of its own, or a symbol member as Node's async hooks put there), a `WeakRef`, an error's cause, or a
 * `Map` iterator, or one of the language's iterators given the prototype of plain data.
 * @param {string} kind - Which holder.
 * @returns {*} The holder.
 */
export function holding(kind) {
	switch (kind) {
		case "map":
		case "mapForEach":
			return new Map([["f", steal]]);
		case "set":
		case "setForEach":
			return new Set([steal]);
		case "promise":
			return { p: Promise.resolve(steal) };
		case "promiseTagged":
			return { p: Object.assign(Promise.resolve(steal), { tag: 1 }) };
		case "promiseSymbol":
			// What Node's async hooks put on a promise made while an `AsyncLocalStorage` runs on them.
			return { p: Object.assign(Promise.resolve(steal), { [Symbol("kResourceStore")]: {} }) };
		case "weakRef":
			return new WeakRef(steal);
		case "cause":
			return new Error("held", { cause: new Map([["f", steal]]) });
		case "plainArrayIterator":
			// An array's iterator given the prototype of plain data, holding an object and a long string of its own.
			return Object.assign(Object.setPrototypeOf([steal][Symbol.iterator](), Object.prototype), { box: {}, text: "x".repeat(5000) });
		case "plainIteratorHelper":
			// An iterator helper given the prototype of plain data, holding an object of its own.
			return Object.assign(
				Object.setPrototypeOf(
					[0][Symbol.iterator]().map(() => steal),
					Object.prototype
				),
				{ box: { inner: [1] } }
			);
		case "bareArrayIterator":
			// An array's iterator with no prototype and no members of its own.
			return Object.setPrototypeOf([steal][Symbol.iterator](), null);
		default:
			return new Map([["f", steal]]).values();
	}
}

/**
 * Plain data holding no code: nested objects, an array, a long string, a date, an object of no prototype.
 * @returns {object} The data.
 */
export function plainData() {
	return { nested: { list: [1, "x".repeat(5000)], when: new Date(0), bare: Object.assign(Object.create(null), { n: 1 }) } };
}

/** How many times the `stack` getter this module defines on an error ran. */
let stackGetterRuns = 0;

/**
 * Data holding an error, by kind: errors of the language's own (with a cause, members of their own, a stack already
 * read), and look-alikes that are not (a disguised array iterator holding an error or posing as one, an error whose
 * prototype was replaced, an error with a `stack` getter of this module's).
 * @param {string} kind - Which.
 * @returns {object} The data.
 */
export function errorData(kind) {
	switch (kind) {
		case "error":
			return { ok: false, error: new Error("x") };
		case "typeError":
			return { error: new TypeError("t") };
		case "aggregate":
			return { error: new AggregateError([new Error("a"), new RangeError("b")], "agg") };
		case "causeAndMembers":
			return { error: Object.assign(new Error("c", { cause: { code: 1 } }), { code: "E1", detail: { n: 1 } }) };
		case "stackRead": {
			const error = new Error("read");
			void error.stack;
			return { error };
		}
		case "iteratorHoldingError":
			return { inner: Object.assign(Object.setPrototypeOf([steal][Symbol.iterator](), Object.prototype), { error: new Error("i") }) };
		case "iteratorPosingAsError":
			return {
				error: Object.assign(Object.setPrototypeOf([steal][Symbol.iterator](), Error.prototype), { message: "p", stack: "Error: p" })
			};
		case "errorBesideIterator":
			return { error: new Error("b"), inner: Object.setPrototypeOf([steal][Symbol.iterator](), Object.prototype) };
		case "prototypeReplaced":
			return { error: Object.setPrototypeOf(new Error("r"), Object.prototype) };
		default: {
			const error = new Error("g");
			Object.defineProperty(error, "stack", {
				get() {
					stackGetterRuns++;
					return "Error: g";
				},
				configurable: true
			});
			return { error };
		}
	}
}

/**
 * How many times the `stack` getter {@link errorData} defines ran.
 * @returns {number} The count.
 */
export function stackGetterCount() {
	return stackGetterRuns;
}

/**
 * A thenable resolving to this module's function.
 * @returns {{then: Function}} The thenable.
 */
export function thenable() {
	return {
		then(resolve) {
			resolve(steal);
		}
	};
}

/** @type {Array<Function>} Callbacks handed to this module, called later with this module's function. */
const callbacks = [];

/**
 * Keep a callback, to be called later with this module's function.
 * @param {Function} callback - The callback.
 * @returns {Function} The callback, handed back.
 */
export function subscribe(callback) {
	callbacks.push(callback);
	return callback;
}

/**
 * Call every kept callback with this module's function, then forget them.
 * @returns {void}
 */
export function publish() {
	for (const callback of callbacks.splice(0)) callback(steal);
}

/**
 * A compiled script of this module's that reads the vault: code held in an internal slot, behind Node's own prototype.
 * @returns {vm.Script} The script.
 */
export function script() {
	globalThis.__slotsSelf = self;
	return new vm.Script("globalThis.__slotsSelf.vault.secret");
}

/**
 * Node's data objects, made by this module: none holds any of its code.
 * @returns {object} The objects.
 */
export function nodeData() {
	return {
		buffer: Buffer.from("hello"),
		blob: new Blob(["hello"]),
		url: new URL("https://example.com/a?b=1"),
		params: new URLSearchParams("a=1"),
		decoder: new TextDecoder(),
		encoder: new TextEncoder(),
		mime: new MIMEType("text/plain;charset=utf-8"),
		address: new net.SocketAddress({ address: "127.0.0.1", port: 80 })
	};
}
