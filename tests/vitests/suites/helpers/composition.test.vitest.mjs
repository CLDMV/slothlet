/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/composition.test.vitest.mjs
 *	@Date: 2026-10-10T00:00:00-07:00 (1791615600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-10T00:00:00-07:00 (1791615600)
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
 * | plain object                  | copy                  | copy                |
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

	it("copies a plain object with its prototype and descriptors, every member replaceable", () => {
		const value = { a: 1 };
		Object.defineProperty(value, "secret", { value: "s", enumerable: false });
		const copy = copyForComposition(value);
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
