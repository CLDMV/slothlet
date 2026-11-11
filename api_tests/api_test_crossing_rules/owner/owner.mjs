/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/owner/owner.mjs
 *	@Date: 2026-11-11T10:00:39-08:00 (1794420039)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T10:13:02-08:00 (1794420782)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Holds a class no node exports and hands its instances, and data holding them, to other modules.
 * @module api_test_crossing_rules/owner
 */

import { self } from "@cldmv/slothlet/runtime";

/** A class no node exports. */
class Foo {
	hi() {
		return "hi";
	}
}

/** An object this module uses as the prototype of what it makes, and also hands on as data. */
const shared = {
	hi() {
		return "hi";
	},
	n: 1
};

/** `shared`'s method as it was written. */
const sharedHi = shared.hi;

export const made = () => Object.create(shared);
export const sharedAsData = () => ({ proto: shared });

/** One object this module holds. */
const held = { n: 1, inst: new Foo() };

/** `Foo`'s method as it was written. */
const originalHi = Foo.prototype.hi;

export const getHeld = () => held;
export const isHeld = (value) => value === held;

/**
 * Which members whose name starts with `prefix` `Foo.prototype` and `shared` hold, removing each, and which of their
 * own members are no longer as written (putting each back).
 * @param {string} prefix - The prefix.
 * @returns {string[]} The rest of each key found on the class (`"shared:"` before one found on `shared`), and the name
 *   of each member changed.
 */
export function landed(prefix) {
	const hit = [];
	for (const key of Reflect.ownKeys(Foo.prototype))
		if (typeof key === "string" && key.startsWith(prefix)) {
			hit.push(key.slice(prefix.length));
			delete Foo.prototype[key];
		}
	if (Foo.prototype.hi !== originalHi) {
		hit.push("hi");
		Foo.prototype.hi = originalHi;
	}
	for (const key of Reflect.ownKeys(shared))
		if (typeof key === "string" && key.startsWith(prefix)) {
			hit.push(`shared:${key.slice(prefix.length)}`);
			delete shared[key];
		}
	if (shared.hi !== sharedHi) {
		hit.push("shared.hi");
		shared.hi = sharedHi;
	}
	if (shared.n !== 1) {
		hit.push("shared.n");
		shared.n = 1;
	}
	return hit;
}

// What the test reads once the instance is gone: this module's own check, run as plain code.
globalThis.__crossingRulesOwner = { landed };

/** The data this module last returned, what it heard emitted, and what its hook was handed. */
let last;
let heard;
let hooked;

export const makeData = () => (last = { inst: new Foo() });
export const makeInstance = () => (last = new Foo());
export const use = (value) => typeof value;
export const useOwn = () => self.owner.use((last = { inst: new Foo() }));

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
}

/**
 * What this module's listener and hook were handed, against the data it returned.
 * @returns {{heardItself: boolean, heardInstance: boolean, hookedItself: boolean, hookedInstance: boolean}} Whether each
 *   was the object it returned, holding an instance of its class.
 */
export function received() {
	return {
		heardItself: heard === last,
		heardInstance: (heard?.inst ?? heard) instanceof Foo,
		hookedItself: hooked === last,
		hookedInstance: (hooked?.inst ?? hooked) instanceof Foo
	};
}

export const fresh = () => ({ inst: new Foo() });
export const freshMaker = () => () => new Foo();

export const bytesWithMember = (size) => Object.assign(new Uint8Array(size), { inst: new Foo() });
export const bufferWithMember = (size) => Object.assign(Buffer.alloc(size), { inst: new Foo() });
export const bytes = (size) => new Uint8Array(size).fill(7);

export const cloneable = () => ({
	a: { b: 1 },
	list: [1, 2, 3],
	when: new Date(0),
	map: new Map([["k", { z: 1 }]]),
	set: new Set([{ s: 1 }]),
	bytes: new Uint8Array([1, 2]),
	inst: new Foo()
});
export const withFunction = () => ({ run: () => 1 });
