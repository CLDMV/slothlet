/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_packages/api/slots/slots.mjs
 *	@Date: 2026-10-27T07:00:18-07:00 (1793109618)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T10:15:16-07:00 (1793466916)
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
 * This module's function, kept where only an engine method reaches it: in a `Map`, a `Set`, behind a promise, a
 * `WeakRef`, an error's cause, or a `Map` iterator.
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
		case "weakRef":
			return new WeakRef(steal);
		case "cause":
			return new Error("held", { cause: new Map([["f", steal]]) });
		default:
			return new Map([["f", steal]]).values();
	}
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
