/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_packages/channels/plug/plug.mjs
 *	@Date: 2026-10-27T07:00:18-07:00 (1793109618)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T01:35:05-07:00 (1793522105)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#597): a module that may not read the vault passing a function of its own that reads it to a
 * module that may, by every route that does not go through slothlet: a callback, an object, an array, a `Map`, an
 * emitter, a generator, a global and a built-in it replaces.
 * @module api_test_returned_packages.channels.plug
 */
import { AsyncResource } from "node:async_hooks";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault's secret.
 * @returns {Promise<*>} The secret, or the error code its read was refused with.
 */
async function evil() {
	try {
		return await self.vault.secret;
	} catch (error) {
		return error.code ?? error.message;
	}
}

/**
 * Hand the function to a callback held in an object.
 * @param {{cb: Function}} holder - The object.
 * @returns {void}
 */
export function objCb(holder) {
	holder.cb(evil);
}

/**
 * Hand the function to a callback held in an array.
 * @param {Function[]} list - The array.
 * @returns {void}
 */
export function arrCb(list) {
	list[0](evil);
}

/**
 * Put the function on an object.
 * @param {object} target - The object.
 * @returns {void}
 */
export function fill(target) {
	target.f = evil;
}

/**
 * Put the function in a `Map`.
 * @param {Map} map - The map.
 * @returns {void}
 */
export function fillMap(map) {
	map.set("f", evil);
}

/**
 * Emit the function on an emitter.
 * @param {import("node:events").EventEmitter} emitter - The emitter.
 * @returns {void}
 */
export function emit(emitter) {
	emitter.emit("x", evil);
}

/**
 * Put the function on the global object.
 * @returns {void}
 */
export function setGlobal() {
	globalThis.__slothletChannelsEvil = evil;
}

/**
 * Replace `JSON.stringify` with a function that also reads the vault.
 * @returns {void}
 */
export function patch() {
	const original = JSON.stringify;
	JSON.stringify = function stringify(...args) {
		evil().then((value) => (globalThis.__slothletChannelsPatched = value));
		return original(...args);
	};
	globalThis.__slothletChannelsRestore = () => (JSON.stringify = original);
}

/**
 * Feed the function into a generator.
 * @param {Generator} generator - The generator.
 * @returns {void}
 */
export function genFeed(generator) {
	generator.next();
	generator.next(evil);
}

/**
 * Put a function on an object that reads the vault through the namespace this module read and kept, for whoever calls
 * it later.
 * @param {object} target - The object.
 * @returns {void}
 */
export function keepNamespace(target) {
	const vault = self.vault;
	target.f = () => {
		try {
			return vault.secret;
		} catch (error) {
			return error.code ?? error.message;
		}
	};
	target.g = () => vault.reveal();
}

/** @type {Array<*>} What the queued chains below collected. */
const collected = [];

/**
 * What the queued chains collected since the last read.
 * @returns {Array<*>} The values.
 */
export function loot() {
	return collected.splice(0);
}

/**
 * Put a function on an object that only queues promise jobs of the engine's own functions: reading a node this module
 * read itself, or reading through `self`, with no code of this module's running when the read happens. Through
 * `"node"`, each read goes through Node's own code (`AsyncResource.bind`) first.
 * @param {object} target - The object.
 * @param {"kept"|"root"|"node"} how - Through a node this module kept, through `self`, or through `self` by way of
 *   Node's code.
 * @returns {void}
 */
export function queueChain(target, how) {
	const push = Array.prototype.push.bind(collected);
	const refused = (error) => push(error?.code ?? String(error));
	if (how === "kept") {
		const vault = self.vault;
		target.f = () => {
			Promise.resolve(0)
				.then(Reflect.get.bind(null, vault, "secret"))
				.then(push, refused);
		};
	} else {
		const through = how === "node" ? (fn) => AsyncResource.bind(fn) : (fn) => fn;
		target.f = () => {
			Promise.resolve(0)
				.then(through(Reflect.get.bind(null, self, "vault")))
				.then((vault) => [vault, "secret"])
				.then(through(Reflect.apply.bind(null, Reflect.get, null)))
				.then(push, refused);
		};
	}
}
