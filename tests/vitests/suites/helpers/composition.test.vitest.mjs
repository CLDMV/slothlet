/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/composition.test.vitest.mjs
 *	@Date: 2026-10-09T21:45:39-07:00 (1791607539)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T23:20:22-07:00 (1791613222)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The one composition rule: what the build changes instead of a module's value.
 *
 * @description
 * | value                         | default               | `addsMembers: true` |
 * | ----------------------------- | --------------------- | ------------------- |
 * | primitive, plain function     | as-is                 | as-is               |
 * | plain object                  | copy (descriptors kept) | copy (members replaceable) |
 * | user Proxy (object/callable)  | layer                 | layer               |
 * | array                         | copy (slice)          | layer               |
 * | class instance, Map           | as-is                 | layer               |
 *
 * @module tests/vitests/suites/helpers/composition
 */

import { describe, it, expect } from "vitest";
import util from "node:util";
import { copyForComposition, relayer } from "@cldmv/slothlet/helpers/composition";

describe("copyForComposition", () => {
	it("returns primitives and plain functions as-is", () => {
		const fn = () => 1;
		expect(copyForComposition(5)).toBe(5);
		expect(copyForComposition(null)).toBe(null);
		expect(copyForComposition(fn, { addsMembers: true })).toBe(fn);
	});

	it("copies a plain object with its descriptors as they are, unless members are added", () => {
		const frozen = Object.freeze({ code: "x" });
		const kept = copyForComposition(frozen);
		expect(kept).not.toBe(frozen);
		expect(Object.getOwnPropertyDescriptor(kept, "code")).toMatchObject({ writable: false, configurable: false });
		expect(Reflect.deleteProperty(kept, "code")).toBe(false);
	});

	it("copies a plain object with its prototype and descriptors, every member replaceable when members are added", () => {
		const value = { a: 1 };
		Object.defineProperty(value, "secret", { value: "s", enumerable: false });
		const copy = copyForComposition(value, { addsMembers: true });
		expect(copy).not.toBe(value);
		expect(Object.getOwnPropertyDescriptor(copy, "secret")).toMatchObject({
			value: "s",
			enumerable: false,
			writable: false,
			configurable: true
		});
		delete copy.a;
		Object.defineProperty(copy, "secret", { value: "named" });
		expect(value).toEqual({ a: 1 });
		expect(value.secret).toBe("s");
	});

	it("copies an array and uses a class instance as-is unless members are added, then layers either", () => {
		const list = ["a"];
		const map = new Map([["k", 1]]);
		expect(copyForComposition(list)).not.toBe(list);
		expect(copyForComposition(list)).toEqual(["a"]);
		expect(copyForComposition(map)).toBe(map);
		const layeredList = copyForComposition(list, { addsMembers: true });
		const layeredMap = copyForComposition(map, { addsMembers: true });
		expect(layeredList).not.toBe(list);
		expect(Array.isArray(layeredList)).toBe(true);
		layeredList.extra = "x";
		layeredMap.extra = "y";
		expect(layeredList[0]).toBe("a");
		expect(layeredMap.get("k")).toBe(1);
		expect(layeredMap.size).toBe(1);
		expect(layeredMap instanceof Map).toBe(true);
		expect(list).toEqual(["a"]);
		expect(Object.hasOwn(map, "extra")).toBe(false);
	});

	it("keeps a class instance the receiver of its methods and getters, private fields included", () => {
		class Counter {
			#n = 0;
			inc() {
				return ++this.#n;
			}
			get value() {
				return this.#n;
			}
		}
		const counter = new Counter();
		const layer = copyForComposition(counter, { addsMembers: true });
		layer.extra = "x";
		expect(layer.inc()).toBe(1);
		expect(layer.value).toBe(1);
		expect(counter.value).toBe(1);
		expect(layer.inc).toBe(layer.inc);
	});

	it("layers a user Proxy, object or callable, and never writes through it", () => {
		const writes = [];
		const trap = {
			set: (t, k) => (writes.push(k), false),
			defineProperty: (t, k) => (writes.push(k), false),
			deleteProperty: (t, k) => (writes.push(k), false)
		};
		const objectProxy = new Proxy({ a: 1 }, trap);
		const callableProxy = new Proxy(() => "called", trap);
		const objectLayer = copyForComposition(objectProxy);
		const callableLayer = copyForComposition(callableProxy, { addsMembers: true });
		expect(util.types.isProxy(objectLayer)).toBe(true);
		objectLayer.extra = 1;
		delete objectLayer.a;
		callableLayer.extra = 2;
		expect(objectLayer.extra).toBe(1);
		expect("a" in objectLayer).toBe(false);
		expect(callableLayer()).toBe("called");
		expect(callableLayer.extra).toBe(2);
		expect(writes).toEqual([]);
	});

	it("describes a callable layer by the value's own keys alone, an arrow Proxy and a class Proxy alike", () => {
		const arrowLayer = copyForComposition(new Proxy(() => 1, {}), { addsMembers: true });
		arrowLayer.extra = 2;
		expect(() => Object.getOwnPropertyDescriptors(arrowLayer)).not.toThrow();
		expect(Reflect.ownKeys(arrowLayer)).not.toContain("prototype");
		expect(Object.keys(arrowLayer)).toEqual(["extra"]);
		expect(arrowLayer()).toBe(1);

		class Widget {
			constructor(size) {
				this.size = size;
			}
		}
		const classLayer = copyForComposition(new Proxy(Widget, {}), { addsMembers: true });
		expect(() => Object.getOwnPropertyDescriptors(classLayer)).not.toThrow();
		expect(classLayer.prototype).toBe(Widget.prototype);
		expect(new classLayer(3)).toBeInstanceOf(Widget);
		expect(new classLayer(3).size).toBe(3);
	});
});

describe("layer receivers and fixed keys", () => {
	it("calls a method the instance owns, set in its constructor, on the instance itself", () => {
		class Counter {
			#count = 0;
			constructor() {
				this.inc = function () {
					return ++this.#count;
				};
				this.tools = Object.assign(() => "tools", { label: "kit" });
			}
		}
		const layer = copyForComposition(new Counter(), { addsMembers: true });
		layer.extra = 1;
		expect(layer.inc()).toBe(1);
		expect(layer.inc()).toBe(2);
		expect(layer.inc).toBe(layer.inc);
		// A function member keeps its own members and still answers as itself.
		expect(layer.tools()).toBe("tools");
		expect(layer.tools.label).toBe("kit");
	});

	it("holds a winning named export over an array's own `length` within the proxy invariants", () => {
		const layer = copyForComposition(["a", "b"], { addsMembers: true });
		const length = () => "named.length";
		// The way assignNamedExport writes a winning export onto a writable member.
		layer.length = length;
		expect(layer.length).toBe(length);
		// A define an array itself refuses is refused here too.
		expect(() => Object.defineProperty(layer, "length", { value: 1, configurable: true })).toThrow(TypeError);
		expect(() => Object.keys(layer)).not.toThrow();
		expect(() => Object.getOwnPropertyDescriptors(layer)).not.toThrow();
		expect(Reflect.ownKeys(layer)).toContain("length");
	});
});

describe("relayer", () => {
	it("lays a new layer over the same value with members in the given order", () => {
		class Store {
			#items = [];
			add(item) {
				this.#items.push(item);
				return this.#items.length;
			}
		}
		const store = new Store();
		const first = copyForComposition(store, { addsMembers: true });
		first.extra = "e";
		const second = relayer(first, [
			["sib", { value: "s" }],
			["extra", { value: "e" }]
		]);
		expect(Object.keys(second)).toEqual(["sib", "extra"]);
		expect(second.add("x")).toBe(1);
		expect(first.add("y")).toBe(2);
	});
});

describe("layer accessor members", () => {
	it("runs a getter it starts with, on the layer, and describes it as an accessor", () => {
		const layer = relayer(new Map([["a", 1]]), [
			[
				"first",
				{
					get() {
						return this.get("a");
					}
				}
			]
		]);
		expect(layer.first).toBe(1);
		const descriptor = Object.getOwnPropertyDescriptor(layer, "first");
		expect(typeof descriptor.get).toBe("function");
		expect("writable" in descriptor).toBe(false);
		expect("value" in descriptor).toBe(false);
		expect(() => Object.getOwnPropertyDescriptors(layer)).not.toThrow();
	});

	it("runs a getter and setter defined on it, and refuses a write to an accessor without a setter", () => {
		const layer = copyForComposition(new Map(), { addsMembers: true });
		let stored = 0;
		Object.defineProperty(layer, "count", {
			get: () => stored,
			set: (value) => {
				stored = value * 2;
			},
			enumerable: true,
			configurable: true
		});
		layer.count = 4;
		expect(stored).toBe(8);
		expect(layer.count).toBe(8);
		Object.defineProperty(layer, "fixed", { get: () => "f", configurable: true });
		expect(layer.fixed).toBe("f");
		expect(Reflect.set(layer, "fixed", "x")).toBe(false);
		expect(layer.fixed).toBe("f");
	});

	it("turns an accessor back into a data member when one is defined over it", () => {
		const layer = copyForComposition([], { addsMembers: true });
		Object.defineProperty(layer, "tag", { get: () => "accessor", configurable: true });
		Object.defineProperty(layer, "tag", { value: "data", writable: true, configurable: true });
		expect(layer.tag).toBe("data");
		const descriptor = Object.getOwnPropertyDescriptor(layer, "tag");
		expect(descriptor.value).toBe("data");
		expect("get" in descriptor).toBe(false);
	});
});
