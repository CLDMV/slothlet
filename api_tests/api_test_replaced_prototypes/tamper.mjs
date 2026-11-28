/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_replaced_prototypes/tamper.mjs
 *	@Date: 2026-11-17T13:23:01-08:00 (1794950581)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:24-08:00 (1795868964)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code that replaces built-in prototype methods for the whole realm, as any module can.
 */

import { context } from "@cldmv/slothlet/runtime";

const saved = { hasOwnProperty: null, then: null, constructor: null, species: null };
const record = { calls: 0, landed: 0, refused: 0 };

/**
 * Replace `Object.prototype.hasOwnProperty` with one that answers false for the keys named.
 * @param {string[]} keys - The keys to deny having.
 * @returns {void}
 */
export function denyOwn(keys) {
	const original = Object.prototype.hasOwnProperty;
	saved.hasOwnProperty ??= original;
	Object.prototype.hasOwnProperty = function hasOwnProperty(key) {
		if (keys.includes(key)) return false;
		return original.call(this, key);
	};
}

/**
 * Replace `Object.prototype.hasOwnProperty` with one that, asked about `key`, writes `value` to that context key
 * first, as whoever is running when it is called.
 * @param {string} key - The context key.
 * @param {*} value - What to write.
 * @returns {void}
 */
export function hijackOwn(key, value) {
	const original = Object.prototype.hasOwnProperty;
	saved.hasOwnProperty ??= original;
	let busy = false;
	Object.prototype.hasOwnProperty = function hasOwnProperty(asked) {
		if (asked === key && !busy) {
			busy = true;
			record.calls++;
			try {
				context[key] = value;
				record.landed++;
			} catch {
				record.refused++;
			} finally {
				busy = false;
			}
		}
		return original.call(this, asked);
	};
}

/**
 * Replace `Promise.prototype.then` with one that hands its fulfillment reaction `forged` in place of `real`.
 * @param {string} real - The value to replace.
 * @param {string} forged - What to hand on instead.
 * @returns {void}
 */
export function forgeThen(real, forged) {
	const original = Promise.prototype.then;
	saved.then ??= original;
	Promise.prototype.then = function then(onFulfilled, onRejected) {
		const forging = typeof onFulfilled === "function" ? (value) => onFulfilled(value === real ? forged : value) : onFulfilled;
		return original.call(this, forging, onRejected);
	};
}

/**
 * Make the promises the engine's `then` builds from `Promise.prototype` ones that hand their fulfillment reactions
 * `forged` in place of `real`: by replacing `Promise.prototype.constructor` with a subclass of `Promise` whose `then`
 * forges (`how` "constructor"), or by giving `Promise` a `Symbol.species` that answers that subclass (`how` "species").
 * @param {string} real - The value to replace.
 * @param {string} forged - What to hand on instead.
 * @param {"constructor"|"species"} how - Which of the two to replace.
 * @returns {void}
 */
export function forgeSpecies(real, forged, how) {
	const Native = Promise;
	class Forging extends Native {
		then(onFulfilled, onRejected) {
			const forging = typeof onFulfilled === "function" ? (value) => onFulfilled(value === real ? forged : value) : onFulfilled;
			return super.then(forging, onRejected);
		}
	}
	if (how === "constructor") {
		saved.constructor ??= Object.getOwnPropertyDescriptor(Native.prototype, "constructor");
		Object.defineProperty(Native.prototype, "constructor", { value: Forging, writable: true, configurable: true, enumerable: false });
	} else {
		saved.species ??= Object.getOwnPropertyDescriptor(Native, Symbol.species);
		Object.defineProperty(Native, Symbol.species, { get: () => Forging, configurable: true });
	}
}

/**
 * What the `hijackOwn` replacement did.
 * @returns {{calls: number, landed: number, refused: number}} Its counts.
 */
export function report() {
	return { ...record };
}

/**
 * Put back what was replaced.
 * @returns {void}
 */
export function restore() {
	if (saved.hasOwnProperty) Object.prototype.hasOwnProperty = saved.hasOwnProperty;
	if (saved.then) Promise.prototype.then = saved.then;
	if (saved.constructor) Object.defineProperty(Promise.prototype, "constructor", saved.constructor);
	if (saved.species) Object.defineProperty(Promise, Symbol.species, saved.species);
	saved.hasOwnProperty = null;
	saved.then = null;
	saved.constructor = null;
	saved.species = null;
	record.calls = record.landed = record.refused = 0;
}
