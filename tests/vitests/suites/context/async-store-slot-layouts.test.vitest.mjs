/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/async-store-slot-layouts.test.vitest.mjs
 *	@Date: 2026-11-25T01:21:23-08:00 (1795598483)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:13-08:00 (1795600273)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Where the async-store probe finds a storage's value, for each layout Node has used.
 *
 * @description
 * `helpers/async-store-slot` runs one probe per process: a storage of its own, run with a fresh marker, then looked
 * for on the running async resource and a fresh promise. On the Node the suite runs on (frames on), the marker is
 * never on the resource, so only the "not exposed" answer is seen in process. The layouts Node uses with frames off
 * (Node 22's default, or `--no-async-context-frame`) are given here by stand-in `node:async_hooks` builtins that keep
 * the value where that Node keeps it: directly under the storage's `kResourceStore`, or in an object under another
 * symbol. Each case loads a fresh copy of the module with its builtins replaced, so its once-per-process probe runs
 * against them.
 * @module tests/vitests/suites/context/async-store-slot-layouts
 */

import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * Load a fresh copy of `helpers/async-store-slot` whose `process.getBuiltinModule` is `getBuiltinModule`.
 * @param {Function} getBuiltinModule - The stand-in.
 * @returns {Promise<object>} The module.
 */
async function loadWith(getBuiltinModule) {
	vi.resetModules();
	vi.doMock("#helpers/intrinsics", async (importOriginal) => {
		const original = await importOriginal();
		return { ...original, Processes: { ...original.Processes, getBuiltinModule } };
	});
	return import("#helpers/async-store-slot");
}

/**
 * Stand-in `node:async_hooks` builtins: an `AsyncLocalStorage` whose `run` puts the store wherever `place` says on
 * the one async resource there is, and an `executionAsyncResource` that returns that resource.
 * @param {function(object, symbol, *): void} place - Puts the store on the resource.
 * @param {{key?: *}} [options] - `key`: the storage's `kResourceStore` (a fresh symbol by default).
 * @returns {{hooks: object, resource: object}} The builtins and the resource.
 */
function standIn(place, { key } = {}) {
	const resource = {};
	class Storage {
		constructor() {
			this.kResourceStore = key === undefined ? Symbol("kResourceStore") : key;
		}
		run(store, fn) {
			place(resource, this.kResourceStore, store);
			return fn();
		}
		disable() {}
	}
	return { hooks: { AsyncLocalStorage: Storage, executionAsyncResource: () => resource }, resource };
}

afterEach(() => {
	vi.doUnmock("#helpers/intrinsics");
	vi.resetModules();
});

describe("Context > async-store slot > no async hooks", () => {
	it("answers not exposed, no slot, when the platform has no getBuiltinModule result", async () => {
		const slot = await loadWith(() => undefined);
		expect(slot.asyncStoreProbeAvailable()).toBe(false);
		expect(slot.asyncStoreExposed()).toBe(false);
		expect(slot.resourceStoreKnown()).toBe(false);
		expect(slot.resourceStoreHolder({})).toBe(null);
	});

	it("answers the same when async_hooks lacks what the probe uses", async () => {
		const slot = await loadWith(() => ({ AsyncLocalStorage: class {}, executionAsyncResource: () => ({}) }));
		expect(slot.asyncStoreProbeAvailable()).toBe(false);
		expect(slot.asyncStoreExposed()).toBe(false);
	});
});

describe("Context > async-store slot > value directly under kResourceStore", () => {
	it("finds the value on the resource itself and hands back the resource as the holder", async () => {
		const { hooks } = standIn((resource, key, store) => {
			resource[key] = store;
		});
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreProbeAvailable()).toBe(true);
		expect(slot.asyncStoreExposed()).toBe(true);
		expect(slot.resourceStoreKnown()).toBe(true);
		const other = {};
		expect(slot.resourceStoreHolder(other)).toBe(other);
		const fn = () => {};
		expect(slot.resourceStoreHolder(fn)).toBe(fn);
	});

	it("hands back null for a resource that is no object", async () => {
		const { hooks } = standIn((resource, key, store) => {
			resource[key] = store;
		});
		const slot = await loadWith(() => hooks);
		expect(slot.resourceStoreHolder(null)).toBe(null);
		expect(slot.resourceStoreHolder(undefined)).toBe(null);
		expect(slot.resourceStoreHolder(5)).toBe(null);
		expect(slot.resourceStoreHolder("resource")).toBe(null);
	});
});

describe("Context > async-store slot > value in an object under another symbol", () => {
	const CONTEXT = Symbol("kAsyncLocalStorageContext");
	const place = (resource, key, store) => {
		// Another symbol before it, holding nothing of the store, so the search goes past it.
		resource[Symbol("other")] = { unrelated: true };
		resource[Symbol("primitive")] = 7;
		resource[CONTEXT] = { [key]: store };
	};

	it("finds the holder under that symbol on any resource that has one", async () => {
		const { hooks } = standIn(place);
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreExposed()).toBe(true);
		expect(slot.resourceStoreKnown()).toBe(true);
		const holder = {};
		expect(slot.resourceStoreHolder({ [CONTEXT]: holder })).toBe(holder);
	});

	it("hands back null where the resource has nothing, or no object, under that symbol", async () => {
		const { hooks } = standIn(place);
		const slot = await loadWith(() => hooks);
		expect(slot.resourceStoreHolder({})).toBe(null);
		expect(slot.resourceStoreHolder({ [CONTEXT]: null })).toBe(null);
		expect(slot.resourceStoreHolder({ [CONTEXT]: 3 })).toBe(null);
		// A getter is never run: only a data property counts.
		let read = false;
		const withGetter = {};
		Object.defineProperty(withGetter, CONTEXT, {
			get() {
				read = true;
				return {};
			}
		});
		expect(slot.resourceStoreHolder(withGetter)).toBe(null);
		expect(read).toBe(false);
	});
});

describe("Context > async-store slot > value reachable, layout not recognised", () => {
	it("answers exposed with no slot when the value sits in a map on the resource", async () => {
		const { hooks } = standIn((resource, key, store) => {
			resource.stores = new Map([["k", store]]);
		});
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreExposed()).toBe(true);
		expect(slot.resourceStoreKnown()).toBe(false);
		expect(slot.resourceStoreHolder({})).toBe(null);
	});

	it("looks past map entries that hold nothing of the value", async () => {
		const { hooks } = standIn((resource, key, store) => {
			resource.stores = new Map([
				["a", 1],
				["b", { other: true }],
				["c", store]
			]);
		});
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreExposed()).toBe(true);
	});

	it("answers no slot when the resource refuses to describe its properties by symbol", async () => {
		let resource;
		class Storage {
			constructor() {
				this.kResourceStore = Symbol("kResourceStore");
			}
			run(store, fn) {
				resource = new Proxy(
					{ found: store },
					{
						getOwnPropertyDescriptor(target, key) {
							if (typeof key === "symbol") throw new Error("no descriptor");
							return Reflect.getOwnPropertyDescriptor(target, key);
						}
					}
				);
				return fn();
			}
			disable() {}
		}
		const slot = await loadWith(() => ({ AsyncLocalStorage: Storage, executionAsyncResource: () => resource }));
		expect(slot.asyncStoreExposed()).toBe(true);
		expect(slot.resourceStoreKnown()).toBe(false);
	});

	it("answers exposed when the value is a map key", async () => {
		const { hooks } = standIn((resource, key, store) => {
			resource.stores = new Map([[store, 1]]);
		});
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreExposed()).toBe(true);
	});

	it("answers exposed with no slot when the storage has no symbol kResourceStore", async () => {
		const { hooks } = standIn(
			(resource, key, store) => {
				resource.slot = store;
			},
			{ key: null }
		);
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreExposed()).toBe(true);
		expect(slot.resourceStoreKnown()).toBe(false);
	});

	it("answers exposed with no slot when the value is under kResourceStore on neither the resource nor a holder", async () => {
		const { hooks, resource } = standIn((target, key, store) => {
			target.nested = { deeper: { value: store } };
		});
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreExposed()).toBe(true);
		expect(slot.resourceStoreKnown()).toBe(false);
		expect(resource.nested.deeper.value).not.toBe(undefined);
	});
});

describe("Context > async-store slot > value out of reach", () => {
	it("answers not exposed when the value is nowhere on the resource", async () => {
		const { hooks } = standIn(() => {});
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreProbeAvailable()).toBe(true);
		expect(slot.asyncStoreExposed()).toBe(false);
		expect(slot.resourceStoreKnown()).toBe(false);
	});

	it("does not look further than a few steps, nor twice at the same object", async () => {
		const { hooks } = standIn((resource, key, store) => {
			// A cycle back to the resource, and the store six steps down.
			resource.self = resource;
			resource.a = { b: { c: { d: { e: { f: store } } } } };
		});
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreExposed()).toBe(false);
	});

	it("passes over what throws when its keys or properties are read", async () => {
		const { hooks } = standIn((resource, key, store) => {
			resource.keysThrow = new Proxy(
				{},
				{
					ownKeys() {
						throw new Error("no keys");
					}
				}
			);
			resource.descriptorThrows = new Proxy(
				{ hidden: store },
				{
					getOwnPropertyDescriptor() {
						throw new Error("no descriptor");
					}
				}
			);
			resource.accessor = Object.defineProperty({}, "value", { get: () => store, enumerable: true });
		});
		const slot = await loadWith(() => hooks);
		expect(slot.asyncStoreExposed()).toBe(false);
	});

	it("passes over a resource whose symbols cannot be listed once the value was found on it", async () => {
		// The probe sees the store (exposed) through a string key on a proxy resource whose symbol listing throws.
		let resource;
		class Storage {
			constructor() {
				this.kResourceStore = Symbol("kResourceStore");
			}
			run(store, fn) {
				let listing = 0;
				resource = new Proxy(
					{ found: store },
					{
						ownKeys(target) {
							listing++;
							// The first listing is the search for the marker; the next one is the symbol scan.
							if (listing > 1) throw new Error("no symbols");
							return Reflect.ownKeys(target);
						}
					}
				);
				return fn();
			}
			disable() {}
		}
		const slot = await loadWith(() => ({ AsyncLocalStorage: Storage, executionAsyncResource: () => resource }));
		expect(slot.asyncStoreExposed()).toBe(true);
		expect(slot.resourceStoreKnown()).toBe(false);
	});
});
