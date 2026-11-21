/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/intrinsics-plain-descriptors.test.vitest.mjs
 *	@Date: 2026-11-17T12:23:41-08:00 (1794947021)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T12:28:08-08:00 (1794947288)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The descriptors slothlet's captured `Reflect.getOwnPropertyDescriptor` and
 * `Objects.getOwnPropertyDescriptor(s)` answer inherit nothing, so a member a descriptor lacks reads as absent whatever
 * module code put on `Object.prototype`, while the members it has, their order, and `in` checks match the engine's.
 */

import { describe, it, expect } from "vitest";
import { Reflect as CapturedReflect, Objects } from "#helpers/intrinsics";

/**
 * Run `fn` with `get`, `set`, `value` and `writable` defined on `Object.prototype`, removed before this returns. `fn`
 * only reads; the assertions run on what it returned, once the members are gone.
 * @param {function(): *} fn - What to run.
 * @returns {*} What `fn` returned.
 */
function withPoisonedObjectPrototype(fn) {
	const names = ["get", "set", "value", "writable"];
	for (const name of names) {
		Object.defineProperty(Object.prototype, name, { __proto__: null, configurable: true, get: () => () => "steered" });
	}
	try {
		return fn();
	} finally {
		for (const name of names) delete Object.prototype[name];
	}
}

const source = {
	data: 1,
	get accessor() {
		return 2;
	}
};

describe("captured getOwnPropertyDescriptor", () => {
	it("answers the engine's members, in the engine's order", () => {
		for (const describe of [CapturedReflect.getOwnPropertyDescriptor, Objects.getOwnPropertyDescriptor]) {
			for (const key of ["data", "accessor"]) {
				const native = Object.getOwnPropertyDescriptor(source, key);
				const plain = describe(source, key);
				expect(Object.keys(plain)).toEqual(Object.keys(native));
				expect({ ...plain }).toEqual({ ...native });
				expect("value" in plain).toBe("value" in native);
				expect("get" in plain).toBe("get" in native);
			}
			expect(describe(source, "missing")).toBeUndefined();
		}
	});

	it("inherits nothing a replaced Object.prototype member could steer", () => {
		const target = Object.create(null);
		const seen = withPoisonedObjectPrototype(() => {
			const data = CapturedReflect.getOwnPropertyDescriptor(source, "data");
			const accessor = Objects.getOwnPropertyDescriptor(source, "accessor");
			Object.defineProperty(target, "data", data);
			Object.defineProperty(target, "accessor", accessor);
			return [data.get, data.set, "get" in data, accessor.value, accessor.writable, "value" in accessor];
		});
		expect(seen).toEqual([undefined, undefined, false, undefined, undefined, false]);
		expect(target.data).toBe(1);
		expect(target.accessor).toBe(2);
	});

	it("getOwnPropertyDescriptors answers a prototype-free map of the same descriptors", () => {
		const sym = Symbol("s");
		const withSymbol = { ...source, [sym]: 3 };
		Object.defineProperty(withSymbol, "accessor", Object.getOwnPropertyDescriptor(source, "accessor"));
		const all = Objects.getOwnPropertyDescriptors(withSymbol);
		expect(Object.getPrototypeOf(all)).toBeNull();
		expect(Reflect.ownKeys(all)).toEqual(Reflect.ownKeys(withSymbol));
		const seen = withPoisonedObjectPrototype(() => [all.data.get, all.accessor.value, all[sym].value]);
		expect(seen).toEqual([undefined, undefined, 3]);
	});
});
