/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/crossing-guard.browser.test.mjs
 *	@Date: 2026-11-10T20:53:39-08:00 (1794372819)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:28:44-08:00 (1794374924)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In a browser, values that cross between modules are held to the same rule as in Node.
 *
 * @description
 * Runs in a real browser, where there is no `node:util`: the engine's brand checks the guard uses come from the
 * platform's own fallbacks, and where one cannot tell, the value is viewed, never handed on as it is. A module handed
 * another module's instance, alone, in data, on a date, or through its own callback, is refused a write onto that
 * module's class; a module granted the writes, and every module while the permission system is off, makes it.
 * @module tests/browser/crossing-guard
 */

import { describe, it, expect } from "vitest";
import { self } from "@cldmv/slothlet/runtime";

describe("browser crossing guard", () => {
	/**
	 * Build an instance of two in-memory modules: the owner of a class no node exports, and a reader.
	 * @param {object} [permissions] - The `permissions` block, or none for the system off.
	 * @returns {Promise<object>} The api.
	 */
	const boot = async (permissions) => {
		const mod = await import("@cldmv/slothlet");
		const slothlet = mod.default ?? mod.slothlet;
		const api = await slothlet({ platform: "browser", mode: "eager", silent: true, ...(permissions ? { permissions } : {}) });
		class Foo {
			hi() {
				return "hi";
			}
		}
		const routes = {
			returned: () => self.owner.make(),
			inData: () => self.owner.inData().inst,
			onDate: () => self.owner.onDate().inst,
			inMap: () => self.owner.inMap().get("k"),
			callback: () => {
				let got;
				self.owner.each((instance) => (got = instance));
				return got;
			}
		};
		await api.slothlet.api.add(
			"owner",
			{
				exports: {
					make: () => new Foo(),
					inData: () => ({ inst: new Foo() }),
					onDate: () => Object.assign(new Date(0), { inst: new Foo() }),
					inMap: () => new Map([["k", new Foo()]]),
					plain: () => ({ a: { b: 1 }, list: [1, 2, 3], map: new Map([["k", { z: 1 }]]) }),
					each: (callback) => callback(new Foo()),
					landed: (key) => {
						const hit = Object.hasOwn(Foo.prototype, key);
						delete Foo.prototype[key];
						return hit;
					}
				}
			},
			{ moduleID: "owner" }
		);
		await api.slothlet.api.add(
			"reader",
			{
				exports: {
					copies: async () => {
						const data = self.owner.plain();
						const copy = structuredClone(data);
						const posted = await new Promise((resolve) => {
							const { port1, port2 } = new MessageChannel();
							port2.onmessage = (event) => {
								port1.close();
								resolve(event.data);
							};
							port1.postMessage({ theirs: data.list });
						});
						// A view answers the engine's brand check as the Proxy it is; the Map itself answers as a Map.
						const viewed = Object.prototype.toString.call(data.map) !== "[object Map]";
						return JSON.stringify([viewed, copy.a, copy.list, [...copy.map], copy !== data, posted]);
					},
					plant: (route, key) => {
						const value = routes[route]();
						try {
							Object.getPrototypeOf(value)[key] = () => "planted";
							return [value.hi(), "written"].join();
						} catch (error) {
							return [value.hi(), error.code ?? error.name].join();
						}
					}
				}
			},
			{ moduleID: "reader" }
		);
		return api;
	};

	const ROUTES = ["returned", "inData", "onDate", "inMap", "callback"];

	it("refuses a reader with no write rule a change to another module's class, by every route", async () => {
		const api = await boot({ defaultPolicy: "allow" });
		const outcome = {};
		const landed = {};
		for (const route of ROUTES) {
			outcome[route] = await api.reader.plant(route, `__browser_${route}`);
			landed[route] = await api.owner.landed(`__browser_${route}`);
		}
		expect(outcome).toEqual(Object.fromEntries(ROUTES.map((route) => [route, "hi,LOOSE_SET_NOT_OWNED"])));
		expect(landed).toEqual(Object.fromEntries(ROUTES.map((route) => [route, false])));
		await api.shutdown();
	});

	it("lets a reader granted the owner's subtree, and every reader with the system off, make the write", async () => {
		const granted = await boot({
			defaultPolicy: "allow",
			rules: [
				{ caller: "reader.**", target: "owner.**:write", effect: "allow" },
				{ caller: "reader.**", target: "owner:write", effect: "allow" }
			]
		});
		expect(await granted.reader.plant("inData", "__browser_granted")).toBe("hi,written");
		expect(await granted.owner.landed("__browser_granted")).toBe(true);
		await granted.shutdown();
		const off = await boot();
		expect(await off.reader.plant("inData", "__browser_off")).toBe("hi,written");
		expect(await off.owner.landed("__browser_off")).toBe(true);
		await off.shutdown();
	});

	it("lets the platform's cloning functions copy another module's data, as plain JavaScript does", async () => {
		const expected = (viewed) => JSON.stringify([viewed, { b: 1 }, [1, 2, 3], [["k", { z: 1 }]], true, { theirs: [1, 2, 3] }]);
		const on = await boot({ defaultPolicy: "allow" });
		expect(await on.reader.copies()).toBe(expected(true));
		await on.shutdown();
		const off = await boot();
		expect(await off.reader.copies()).toBe(expected(false));
		await off.shutdown();
		// With the last instance gone the platform's own function is back.
		expect(globalThis.structuredClone[Symbol.for("slothlet.clone.original")]).toBeUndefined();
	});

	it("answers the engine's brand checks without node:util", async () => {
		const { util } = await import("@cldmv/slothlet/helpers/platform");
		const types = util.types;
		const checks = {
			isMap: [new Map(), {}],
			isSet: [new Set(), []],
			isWeakMap: [new WeakMap(), new Map()],
			isWeakSet: [new WeakSet(), new Set()],
			isDate: [new Date(), Object.create(Date.prototype)],
			isRegExp: [/x/, RegExp.prototype],
			isArrayBuffer: [new ArrayBuffer(1), new Uint8Array(1)],
			isAnyArrayBuffer: [new ArrayBuffer(1), {}],
			isArrayBufferView: [new Uint8Array(1), new ArrayBuffer(1)],
			isDataView: [new DataView(new ArrayBuffer(1)), new Uint8Array(1)],
			isTypedArray: [new Uint8Array(1), new DataView(new ArrayBuffer(1))],
			isBoxedPrimitive: [Object("s"), {}],
			isNativeError: [new TypeError("x"), {}],
			isMapIterator: [new Map().entries(), new Set().values()],
			isSetIterator: [new Set().values(), new Map().entries()],
			isGeneratorFunction: [function* () {}, () => {}]
		};
		const answers = Object.fromEntries(
			Object.entries(checks).map(([name, [yes, no]]) => [name, [types[name](yes), types[name](no), types[name](null)]])
		);
		expect(answers).toEqual(Object.fromEntries(Object.keys(checks).map((name) => [name, [true, false, false]])));
		// A Proxy never passes a brand check, whatever it stands over.
		expect([types.isMap(new Proxy(new Map(), {})), types.isDate(new Proxy(new Date(), {}))]).toEqual([false, false]);
		expect(types.isSharedArrayBuffer(new ArrayBuffer(1))).toBe(false);
		expect(types.isKeyObject({})).toBe(false);
		expect(types.isCryptoKey({})).toBe(false);
	});
});
