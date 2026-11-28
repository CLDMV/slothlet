/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/helpers/composition-layer-edges.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:47-08:00 (1795869107)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Edges of a composition layer: how it recognises its own Proxies, how it defines members over accessors
 * and non-configurable members, what it reports for a key it does not hold, `layerOnto`, and the one-take rule of the
 * module's internal bindings.
 *
 * @description
 * Each member-definition case runs the same calls on a layer and on a plain object twin, and expects the layer to answer
 * as the twin does (the plain-JavaScript answer).
 */
import { describe, it, expect } from "vitest";
import { copyForComposition, copySourceOf, isCompositionProxy, layerOnto, relayer } from "#helpers/composition";

/**
 * What a call does: its result, or the name of what it threw.
 * @param {Function} fn - The call.
 * @returns {string} "ok" or the error's name.
 */
function attempt(fn) {
	try {
		fn();
		return "ok";
	} catch (error) {
		return error.name;
	}
}

/**
 * A layer that holds nothing yet, beside its plain-object twin.
 * @returns {object[]} `[layer, twin]`.
 */
function pair() {
	return [copyForComposition(new Map(), { addsMembers: true }), {}];
}

describe("composition > isCompositionProxy / copySourceOf", () => {
	it("is true for a layer and for a method read through one, false for anything else", () => {
		const layer = copyForComposition(new Map([["a", 1]]), { addsMembers: true });
		expect(isCompositionProxy(layer)).toBe(true);
		expect(isCompositionProxy(layer.get)).toBe(true);
		expect(isCompositionProxy(new Map())).toBe(false);
		expect(isCompositionProxy({})).toBe(false);
		expect(isCompositionProxy(5)).toBe(false);
	});

	it("names the object a copy was made from, and nothing for a value that is no copy", () => {
		const source = { a: 1 };
		expect(copySourceOf(copyForComposition(source))).toBe(source);
		expect(copySourceOf(source)).toBeUndefined();
		expect(copySourceOf(5)).toBeUndefined();
		expect(copySourceOf(null)).toBeUndefined();
	});
});

describe("composition > redefining an accessor member", () => {
	it("keeps the getter when only a setter is defined over it, as an object does", () => {
		const [layer, twin] = pair();
		const get = () => "g";
		const set1 = () => {};
		const set2 = () => {};
		for (const target of [layer, twin]) {
			Object.defineProperty(target, "p", { get, set: set1, configurable: true, enumerable: true });
			Object.defineProperty(target, "p", { set: set2, configurable: true });
		}
		const own = Object.getOwnPropertyDescriptor(layer, "p");
		const plain = Object.getOwnPropertyDescriptor(twin, "p");
		expect(own.get).toBe(plain.get);
		expect(own.set).toBe(plain.set);
		expect(own.enumerable).toBe(plain.enumerable);
	});

	it("keeps the setter when only a getter is defined over it, as an object does", () => {
		const [layer, twin] = pair();
		const get1 = () => 1;
		const get2 = () => 2;
		const set = () => {};
		for (const target of [layer, twin]) {
			Object.defineProperty(target, "p", { get: get1, set, configurable: true });
			Object.defineProperty(target, "p", { get: get2, configurable: true });
		}
		const own = Object.getOwnPropertyDescriptor(layer, "p");
		const plain = Object.getOwnPropertyDescriptor(twin, "p");
		expect(own.get).toBe(plain.get);
		expect(own.set).toBe(plain.set);
	});

	it("reads a member with a setter and no getter as undefined, as an object does", () => {
		const layer = relayer(new Map(), [["w", { set() {}, configurable: true, enumerable: true }]]);
		const twin = Object.defineProperty({}, "w", { set() {}, configurable: true, enumerable: true });
		expect(layer.w).toBe(twin.w);
		expect(layer.w).toBeUndefined();
	});
});

describe("composition > non-configurable members", () => {
	it("changes one as an object allows, and refuses the rest as an object does", () => {
		const [layer, twin] = pair();
		const steps = [
			(target) => Object.defineProperty(target, "k", { value: 1, writable: true, configurable: false, enumerable: true }),
			(target) => Object.defineProperty(target, "k", { value: 2 }),
			(target) => Object.defineProperty(target, "k", { value: 3, writable: false }),
			(target) => Object.defineProperty(target, "k", { value: 4 }),
			(target) => Object.defineProperty(target, "k", { configurable: true }),
			(target) => {
				if (!delete target.k) throw new TypeError("not deletable");
			}
		];
		for (const step of steps) {
			expect(attempt(() => step(layer))).toBe(attempt(() => step(twin)));
			expect(layer.k).toBe(twin.k);
		}
		expect(layer.k).toBe(3);
	});

	it("keeps the first definition of a member held non-configurable when the same key is held again at the start", () => {
		const layer = relayer(new Map(), [
			["k", { value: 1, writable: false, configurable: false, enumerable: true }],
			["k", { value: 2, writable: false, configurable: false, enumerable: true }]
		]);
		expect(layer.k).toBe(1);
		expect(Object.getOwnPropertyDescriptor(layer, "k").configurable).toBe(false);
	});
});

describe("composition > keys the layer does not hold", () => {
	it("defines a brand new member as an object does, with the attributes it leaves out false", () => {
		const [layer, twin] = pair();
		Object.defineProperty(layer, "fresh", { value: 1 });
		Object.defineProperty(twin, "fresh", { value: 1 });
		const own = Object.getOwnPropertyDescriptor(layer, "fresh");
		const plain = Object.getOwnPropertyDescriptor(twin, "fresh");
		expect({ ...own }).toEqual({ ...plain });
	});

	it("reports no descriptor for an absent key and for a key it hid", () => {
		const layer = copyForComposition(new Map([["x", 1]]), { addsMembers: true });
		layer.held = 1;
		expect(Object.getOwnPropertyDescriptor(layer, "absent")).toBeUndefined();
		expect(delete layer.held).toBe(true);
		expect(Object.getOwnPropertyDescriptor(layer, "held")).toBeUndefined();
		expect("held" in layer).toBe(false);
	});
});

describe("composition > layerOnto", () => {
	it("lays what a layer holds and hides over another value", () => {
		const original = new Map();
		Object.assign(original, { keep: "o", gone: "o" });
		const layer = copyForComposition(original, { addsMembers: true });
		layer.added = "a";
		delete layer.gone;
		const standIn = { keep: "s", gone: "s", other: "s" };
		const onto = layerOnto(layer, standIn);
		expect(onto.added).toBe("a");
		expect("gone" in onto).toBe(false);
		expect(onto.keep).toBe("s");
		expect(onto.other).toBe("s");
		expect(standIn.gone).toBe("s");
	});

	it("lays a value that is no layer over another as a layer that holds nothing", () => {
		const onto = layerOnto({ a: 1 }, { b: 2 });
		expect(onto.b).toBe(2);
		expect("a" in onto).toBe(false);
	});
});

describe("composition > internal bindings", () => {
	it("hands them to the wrapper's entry once, and refuses it a second time and any other file", async () => {
		const mod = await import(
			/* @vite-ignore */ new URL("../../../../src/lib/helpers/composition.mjs?internals-copy", import.meta.url).href
		);
		expect(typeof mod.internals("lib/handlers/unified-wrapper").setApiNodeCheck).toBe("function");
		expect(() => mod.internals("lib/handlers/unified-wrapper")).toThrow();
		expect(() => mod.internals("lib/other")).toThrow();
	});
});
