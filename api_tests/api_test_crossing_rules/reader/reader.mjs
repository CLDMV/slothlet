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

import { types } from "node:util";
import v8 from "node:v8";
import { MessageChannel } from "node:worker_threads";
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
	return { wrapped: types.isProxy(value), isHeld: self.owner.isHeld(value), write };
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
	return types.isProxy(kept);
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

/**
 * Reach the object the owner uses as a prototype both as data and as the prototype of what the owner makes, and try
 * every change to it through the data.
 * @param {string} prefix - The prefix of the members written.
 * @param {"instanceFirst"|"dataFirst"} order - Which of the two this module is handed first.
 * @returns {object} How each change ended, and whether the two are the same object.
 */
export function prototypeAsData(prefix, order) {
	let instance;
	let data;
	if (order === "instanceFirst") {
		instance = self.owner.made();
		data = self.owner.sharedAsData();
	} else {
		data = self.owner.sharedAsData();
		instance = self.owner.made();
	}
	const target = data.proto;
	const attempt = (write) => {
		try {
			write();
			return "written";
		} catch (error) {
			return error?.code ?? String(error);
		}
	};
	return {
		replaced: attempt(() => (target.hi = () => "planted")),
		addedFunction: attempt(() => (target[`${prefix}fn`] = () => "planted")),
		addedData: attempt(() => (target[`${prefix}data`] = 1)),
		changedData: attempt(() => (target.n = 2)),
		defined: attempt(() => Object.defineProperty(target, `${prefix}defined`, { value: 1, configurable: true })),
		deleted: attempt(() => {
			if (!Reflect.deleteProperty(target, "n")) throw new Error("kept");
		}),
		same: Object.getPrototypeOf(instance) === target,
		inherited: instance.hi()
	};
}

/** What this module's listener heard and its hook was handed. */
let heard;
let hooked;

/**
 * Listen for the relayed event and hook the host's call.
 * @returns {void}
 */
export function listen() {
	self.slothlet.event.on("crossing-rules:relay", (payload) => {
		heard = payload;
	});
	self.slothlet.hook.on("host.take:before", ({ args }) => {
		hooked = args[0];
	});
	self.slothlet.hook.on("owner.use:before", ({ args }) => {
		hooked = args[0];
	});
}

/**
 * What this module's listener and hook were handed, and how a write onto the class of the instance in each ends.
 * @param {string} prefix - The prefix of the members written.
 * @returns {object} Whether each was a view, and each write's outcome.
 */
export function received(prefix) {
	const plant = (holder, key) => {
		try {
			Object.getPrototypeOf(holder.inst ?? holder)[key] = () => "planted";
			return "written";
		} catch (error) {
			return error?.code ?? String(error);
		}
	};
	return {
		heardWrapped: types.isProxy(heard),
		heardWrite: plant(heard, `${prefix}heard`),
		hookedWrapped: types.isProxy(hooked),
		hookedWrite: plant(hooked, `${prefix}hooked`)
	};
}

/**
 * Replace the language's own functions slothlet's checks rest on, reach the owner's instances while they are replaced,
 * put them back, and try to write onto the owner's class through what was reached.
 * @param {string} prefix - The prefix of the members written.
 * @returns {Object<string, string>} How each write ended.
 */
export function steered(prefix) {
	const saved = {
		create: Object.create,
		symbols: Object.getOwnPropertySymbols,
		from: Array.from,
		get: Reflect.get,
		ownKeys: Reflect.ownKeys,
		describe: Reflect.getOwnPropertyDescriptor,
		getPrototypeOf: Reflect.getPrototypeOf,
		toString: Function.prototype.toString,
		Proxy: globalThis.Proxy
	};
	let data;
	let made;
	let failure = null;
	try {
		Object.create = () => "x";
		Object.getOwnPropertySymbols = () => [];
		Array.from = () => [];
		Reflect.get = (target, key) => target[key];
		Reflect.ownKeys = () => [];
		Reflect.getOwnPropertyDescriptor = () => undefined;
		Reflect.getPrototypeOf = () => null;
		// Every function now reports itself as one of the engine's own.
		Function.prototype.toString = function () {
			return "function push() { [native code] }";
		};
		globalThis.Proxy = function (target) {
			return target;
		};
		data = self.owner.fresh();
		made = self.owner.freshMaker()();
	} catch (error) {
		failure = error?.code ?? String(error);
	} finally {
		Object.create = saved.create;
		Object.getOwnPropertySymbols = saved.symbols;
		Array.from = saved.from;
		Reflect.get = saved.get;
		Reflect.ownKeys = saved.ownKeys;
		Reflect.getOwnPropertyDescriptor = saved.describe;
		Reflect.getPrototypeOf = saved.getPrototypeOf;
		Function.prototype.toString = saved.toString;
		globalThis.Proxy = saved.Proxy;
	}
	if (failure !== null) return { reached: failure };
	const plant = (instance, key) => {
		try {
			Object.getPrototypeOf(instance)[key] = () => "planted";
			return "written";
		} catch (error) {
			return error?.code ?? String(error);
		}
	};
	return { reached: "both", data: plant(data.inst, `${prefix}data`), made: plant(made, `${prefix}made`) };
}

/**
 * Take a typed array from the owner and say how it reached this module, and how a write onto the class of the instance
 * stored on it ends.
 * @param {string} prefix - The prefix of the member written.
 * @param {"bytesWithMember"|"bufferWithMember"|"bytes"} kind - Which of the owner's functions makes it.
 * @param {number} size - Its length in bytes.
 * @returns {{wrapped: boolean, write: string, first: number, length: number, copied: number}} What it got.
 */
export function typed(prefix, kind, size) {
	const value = self.owner[kind](size);
	let write = "none";
	if (value.inst) {
		try {
			Object.getPrototypeOf(value.inst)[`${prefix}${kind}`] = () => "planted";
			write = "written";
		} catch (error) {
			write = error?.code ?? String(error);
		}
	}
	// Native consumers take it either way: a copy is made from its bytes.
	return { wrapped: types.isProxy(value), write, first: value[0], length: value.length, copied: new Uint8Array(value).length };
}

/**
 * Copy the owner's data with each of the platform's cloning functions.
 * @param {object} [owner] - The owner's functions: this module's `self.owner`, or the owner imported as a plain module.
 * @returns {Promise<Object<string, string>>} What each copy holds, or how the copy was refused.
 */
export async function clones(owner = self.owner) {
	const data = owner.cloneable();
	const answers = {};
	const answer = async (name, read) => {
		try {
			answers[name] = JSON.stringify(await read());
		} catch (error) {
			answers[name] = `threw ${error?.name}`;
		}
	};
	const shape = (copy) => [copy.a, copy.list, copy.when.getTime(), [...copy.map], [...copy.set], [...copy.bytes], copy.inst, copy !== data];
	await answer("structuredClone", () => shape(structuredClone(data)));
	await answer("member", () => structuredClone(data.a));
	await answer("insideOwnObject", () => structuredClone({ mine: 1, theirs: data.a, list: [data.list] }));
	await answer("insideOwnMap", () => [...structuredClone(new Map([["k", data.a]]))]);
	await answer("serialize", () => v8.deserialize(v8.serialize(data.a)));
	await answer(
		"posted",
		() =>
			new Promise((resolve, reject) => {
				const { port1, port2 } = new MessageChannel();
				port2.once("message", (message) => {
					port1.close();
					resolve(message);
				});
				try {
					port1.postMessage({ theirs: data.list });
				} catch (error) {
					port1.close();
					reject(error);
				}
			})
	);
	await answer("transferred", () => {
		const copy = structuredClone({ theirs: data.a, buffer: new ArrayBuffer(4) }, { transfer: [] });
		return [copy.theirs, copy.buffer.byteLength];
	});
	// What the platform cannot copy is refused as it is for the value itself.
	await answer("withFunction", () => structuredClone(owner.withFunction()));
	// The copy is the reader's own: nothing of the owner's is reached through it.
	await answer("copyIsPlain", () => Object.getPrototypeOf(structuredClone(data).inst) === Object.prototype);
	return answers;
}
