/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_array_capture/store.mjs
 *	@Date: 2026-10-24T15:16:48-07:00 (1792880208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T20:21:13-07:00 (1792898473)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#655): a module holding frozen, sealed and mutable arrays and objects.
 */

import { self } from "@cldmv/slothlet/runtime";

/** @type {ReadonlyArray<number>} */
export const prims = Object.freeze([1, 2, 3]);

/** @type {ReadonlyArray<object>} */
export const objs = Object.freeze([{ a: 1 }, { b: 2 }]);

/** @type {ReadonlyArray<ReadonlyArray<*>>} */
export const nested = Object.freeze([Object.freeze([1, 2]), Object.freeze([{ c: 3 }])]);

/** @type {ReadonlyArray<*>} A frozen array holding a function and an object holding a function. */
export const fns = Object.freeze([() => "F0", Object.freeze({ run: () => "RUN", note: "NOTE" }), { run: () => "RUN2", note: "NOTE2" }]);

/** @type {Array<*>} The same shape, not frozen. */
export const mfns = [() => "F0", { run: () => "RUN", note: "NOTE" }, { run: () => "RUN2", note: "NOTE2" }];

/** @type {Array<object>} A sealed, not frozen, array. */
export const sealed = Object.seal([{ s: 1 }, { s: 2 }]);

/** @type {Array<object>} An array the test freezes after a first read. */
export const later = [{ l: 1 }, () => "LATER"];

/** @type {ReadonlyArray<object>} A frozen array holding a frozen object. */
export const deep = Object.freeze([Object.freeze({ a: "DEEP" }), { a: "SOFT" }]);

/** @type {Readonly<object>} A frozen object export with object and function members. */
export const ns = Object.freeze({
	inner: { x: 1 },
	frozenInner: Object.freeze({ y: 2 }),
	fn: () => "NSFN",
	list: Object.freeze([{ z: 3 }])
});

/** @type {Readonly<object>} A frozen object holding each kind of function: some own a `prototype`, some do not. */
export const kinds = Object.freeze({
	arrow: () => "ARROW",
	method: {
		method() {
			return "METHOD";
		}
	}.method,
	klass: class Klass {
		/** @returns {string} The tag. */
		tag() {
			return "KLASS";
		}
	},
	plain: function plain() {
		return "PLAIN";
	},
	bound: function bound() {
		return "BOUND";
	}.bind(null)
});

/** @type {Array<number>} An array the module itself changes, then closes. */
export const mut = [1, 2];

/** @type {Array<number>} A sealed array the module itself changes, then freezes. */
export const sealedMut = Object.seal([1, 2]);

/** @type {Array<*>} A sealed array the module marks read-only member by member. */
export const sealedSoft = Object.seal([{ a: 1 }, 2]);

/** @type {Array<*>} An array closed to extension, whose members the module deletes. */
export const closedArr = Object.preventExtensions([{ a: 1 }, 2, 3]);

/** @type {object} An object one module may read all of but `secret`. */
export const dObj = { secret: "S3CRET", n: 1, inner: { x: 1 } };

/** @type {Array<*>} An array one module may read all of but its first element. */
export const dArr = ["S3CRET", 1, { x: 1 }];

/** @type {Array<*>} An array with a hidden element and a hidden named member, one module may read neither of. */
export const hArr = ["H0", "S3CRET", 2];
Object.defineProperty(hArr, 1, { enumerable: false });
Object.defineProperty(hArr, "extra", { value: "S3CRET", enumerable: false, writable: true, configurable: true });

/** @type {object} A sealed object holding an object with a member one module may not read. */
export const sealedHid = Object.seal({ inner: { x: 1, hid: "S3CRET" }, n: 1 });

/** @type {object} A frozen object holding a frozen object with a member one module may not read. */
export const frozenHid = Object.freeze({ inner: Object.freeze({ x: 1, hid: "S3CRET" }), n: 1 });

/**
 * The keys this module's own `inner` objects hold, read straight off its exports, not through `self`.
 * @returns {{sealedHid: string[], frozenHid: string[]}} The keys.
 */
export function ownInnerKeys() {
	return { sealedHid: Object.keys(sealedHid.inner), frozenHid: Object.keys(frozenHid.inner) };
}

/** @type {object} An object the module closes, then changes. */
export const iObj = { n: 1, m: 1 };

/**
 * Change this module's own member through `self`: write an element, delete one, seal, freeze or close it, mark an
 * element read-only, or turn a member into a getter.
 * @param {string} name - The member.
 * @param {{set?: [number, *], remove?: number, close?: "seal"|"freeze"|"preventExtensions", readOnly?: number, getter?: [string, *]}} change - What to do.
 * @returns {string} "done", or what the change threw or refused.
 */
export function changeOwn(name, change) {
	try {
		if (change.set) self.store[name][change.set[0]] = change.set[1];
		if (change.remove !== undefined && !delete self.store[name][change.remove]) return "NOT_DELETED";
		if (change.close === "seal") Object.seal(self.store[name]);
		if (change.close === "freeze") Object.freeze(self.store[name]);
		if (change.close === "preventExtensions") Object.preventExtensions(self.store[name]);
		if (change.readOnly !== undefined && !Reflect.defineProperty(self.store[name], change.readOnly, { writable: false }))
			return "NOT_DEFINED";
		if (change.getter && !Reflect.defineProperty(self.store[name], change.getter[0], { get: () => change.getter[1], enumerable: true })) {
			return "NOT_DEFINED";
		}
		return "done";
	} catch (error) {
		return error.code ?? `${error.name}: ${error.message}`;
	}
}
