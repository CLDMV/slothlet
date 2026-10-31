/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_packages/api/esm/esm.mjs
 *	@Date: 2026-10-27T06:57:33-07:00 (1793109453)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-30T23:03:19-07:00 (1793426599)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#597): a module handing out values it did not write — a package's ES module exports, a
 * CommonJS package's exports, a built-in's class and slothlet's runtime — and a function of its own.
 * @module api_test_returned_packages.esm
 */
import * as runtime from "@cldmv/slothlet/runtime";
import { self } from "@cldmv/slothlet/runtime";
import { EventEmitter } from "node:events";
import { Thing, tools } from "fake-esm";
import fakeCjs from "fake-cjs";

/**
 * The values this module imported, handed on.
 * @returns {{runtime: object, EventEmitter: Function, Thing: Function, tools: object, make: Function, fakeCjs: object}} The values.
 */
export function refs() {
	return { runtime, EventEmitter, Thing, tools, make: tools.make, fakeCjs };
}

/**
 * Put a function of this module's own on a built-in's class, and hand the class on.
 * @returns {Function} The class.
 */
export function plantOnBuiltin() {
	EventEmitter.slothletTestPlanted = function planted() {
		return "planted";
	};
	return EventEmitter;
}

/**
 * Put a function of this module's own deep under a built-in's class, and hand the class on.
 * @returns {Function} The class.
 */
export function plantDeepOnBuiltin() {
	EventEmitter.prototype.slothletTestDeep = {
		a: {
			b: {
				c: function planted() {
					return "planted";
				}
			}
		}
	};
	return EventEmitter;
}

/**
 * Try to have a function of this module's own recorded as made by no module, through the instance-import state's
 * hooks, and hand it out.
 * @returns {Function} The function.
 */
export function forge() {
	const forged = function forged() {
		return "forged";
	};
	const state = globalThis[Symbol.for("@cldmv/slothlet.instanceImportState")];
	try {
		state?.recordShared?.("file:///nowhere/node_modules/x/index.js", forged, "guessed");
	} catch {
		// A refusal is as good as nothing recorded.
	}
	try {
		Object.defineProperty(globalThis, Symbol.for("@cldmv/slothlet.instanceImportState"), { value: {} });
	} catch {
		// The state cannot be replaced.
	}
	return forged;
}

/**
 * A function this module makes that reads the vault's secret through `self`.
 * @returns {function(): Promise<*>} The function: the secret, or the error code its read was refused with.
 */
export function reader() {
	return async function read() {
		try {
			return await self.vault.secret;
		} catch (error) {
			return error.code ?? error.message;
		}
	};
}

/**
 * A function this module makes.
 * @returns {Function} The function.
 */
export function own() {
	return function made() {
		return "made";
	};
}

/**
 * Call `steal()` on what the slots module hands out, as this module.
 * @param {string} kind - The slots module's function.
 * @returns {Promise<*>} The secret, or the error code its read was refused with.
 */
export async function viaSlots(kind) {
	const value = await self.slots[kind]();
	return value.steal();
}

/**
 * Call a function handed to this module.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} What it returned.
 */
export async function call(fn) {
	return fn();
}

/**
 * A function this module makes that reads the vault's secret through `self` from a timer.
 * @returns {function(): Promise<*>} The function: the secret, or the error code its read was refused with.
 */
export function laterReader() {
	return () =>
		new Promise((resolve) =>
			setTimeout(() => {
				try {
					Promise.resolve(self.vault.secret).then(resolve, (error) => resolve(error.code ?? error.message));
				} catch (error) {
					resolve(error.code ?? error.message);
				}
			}, 5)
		);
}

/**
 * Call a function handed to this module after a turn of the event loop, so this call is suspended while it runs.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} What it returned.
 */
export async function callLater(fn) {
	await new Promise((resolve) => setTimeout(resolve, 1));
	return fn();
}

/**
 * Take the slots module's function out of what holds it, and call it, as this module.
 * @param {string} kind - Which holder (see the slots module's `holding`).
 * @returns {Promise<*>} The secret, or the error code its read was refused with.
 */
export async function viaHolding(kind) {
	const held = await self.slots.holding(kind);
	switch (kind) {
		case "map":
			return held.get("f")();
		case "set":
			return [...held][0]();
		case "promise":
			return (await held.p)();
		case "weakRef":
			return held.deref()();
		case "cause":
			return held.cause.get("f")();
		case "mapForEach":
		case "setForEach": {
			let result;
			held.forEach((value) => {
				result = value();
			});
			return result;
		}
		default:
			return held.next().value();
	}
}

/**
 * Take the slots module's function from what it calls back with, after its call is over, and call it, as this module.
 * @param {"thenable"|"callback"} kind - A thenable it resolves, or a callback it keeps and calls later.
 * @returns {Promise<*>} The secret, or the error code its read was refused with.
 */
export async function viaCallback(kind) {
	if (kind === "thenable") return (await self.slots.thenable())();
	let received = null;
	const callback = (fn) => {
		received = fn;
	};
	const handedBack = await self.slots.subscribe(callback);
	if (handedBack !== callback) return "not the same callback";
	await self.slots.publish();
	return received();
}
