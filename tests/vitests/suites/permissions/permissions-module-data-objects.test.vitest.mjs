/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-data-objects.test.vitest.mjs
 *	@Date: 2026-10-24T04:21:35-07:00 (1792840895)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T02:52:51-07:00 (1793008371)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's data objects — its `Map`s, `Set`s, `Date`s, buffers, typed arrays, and `RegExp`s — are
 * held to the same rule as the rest of its data (#625).
 *
 * Another module reading one through `self` can read and use it as plain JS does — `get`, `has`, iteration, `test` —
 * where the read rules let it reach the module at all.
 * Changing it — through a method that changes it (`set`, `clear`, `setFullYear`, `fill`, `transfer`), by assigning
 * an element or a member, or by changing its prototype — is a write to the path it was read at: refused unless the
 * reader owns that path or a `:write` rule grants it the write. What it holds comes back held to the same rule.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `base/`, `victim/`, `guest/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import vm from "node:vm";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

const INITIAL = {
	cache: "cfg",
	cfgLevel: 1,
	cacheProto: true,
	tags: "a",
	when: 0,
	bufferLength: 8,
	bytes: "1,2,3",
	lastIndexSource: "x",
	patternExtra: undefined,
	memberN: 0,
	registryLevel: 0,
	registryLookup: 1,
	cacheOwnKeys: ""
};

/**
 * The report expected when every change has the same outcome.
 * @param {Record<string, string>} report - Outcomes by change.
 * @param {string} outcome - The outcome.
 * @returns {Record<string, string>} The same keys, each `outcome`.
 */
const every = (report, outcome) => Object.fromEntries(Object.keys(report).map((key) => [key, outcome]));

describe.each(CONFIGS)("a module's data objects (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module, `victim`, and `guest`.
	 * @param {object} options - Further slothlet options.
	 * @returns {Promise<object>} The composed api.
	 */
	async function load(options) {
		api = await slothlet({ base: path.join(FIXTURE, "base"), mode, runtime, silent: true, ...options });
		await api.slothlet.api.add("victim", path.join(FIXTURE, "victim"), { moduleID: "victim" });
		await api.slothlet.api.add("guest", path.join(FIXTURE, "guest"), { moduleID: "guest" });
		return api;
	}

	it("refuses another module changing them, and leaves them as they were", async () => {
		await load({ permissions: {} });
		const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimData());
		expect(report).toEqual(every(report, "LOOSE_SET_NOT_OWNED"));
		expect(await api.victim.v.dataState()).toEqual(INITIAL);
	});

	it("lets another module change them with the permission system off", async () => {
		await load({});
		const report = api.guest.x.changeVictimData();
		// The changes run in order on the objects themselves, as in plain JS: the cleared map no longer holds the entry a
		// later change reaches for, and the resize finds the buffer the transfer detached.
		expect(report).toEqual({ ...every(report, "done"), mapNested: "TypeError", bufferResize: "TypeError" });
		expect(api.victim.v.data.tags.size).toBe(0);
		expect(api.victim.v.data.when.getFullYear()).toBe(2000);
		expect(api.victim.v.data.buffer.detached).toBe(true);
	});

	it("refuses another module changing them by any other route, and leaves them as they were", async () => {
		await load({ permissions: {} });
		const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimDataByRoute());
		expect(report).toEqual(every(report, "LOOSE_SET_NOT_OWNED"));
		expect(await api.victim.v.dataState()).toEqual(INITIAL);
	});

	it("lets another module change them by any other route with the permission system off", async () => {
		await load({});
		const report = api.guest.x.changeVictimDataByRoute();
		expect(report).toEqual(every(report, "done"));
		expect(await api.victim.v.dataState()).not.toEqual(INITIAL);
	});

	it("hands another module what a promise or a WeakRef of a module holds viewed, however it is reached", async () => {
		await load({ permissions: {} });
		const value = { n: 0 };
		await api.slothlet.api.add(
			"syn",
			{ pending: Promise.resolve(value), ref: new WeakRef(value), map: new Map([["k", value]]) },
			{ moduleID: "syn" }
		);
		globalThis[Symbol.for("slothlet.test.i625.probe")] = async (self) => {
			const outcome = async (change) => {
				try {
					await change();
					return "done";
				} catch (error) {
					return error?.code ?? String(error);
				}
			};
			// Everything is reached synchronously, while the module's call is current; what is judged is the write.
			const pending = [self.syn.pending.then(), self.syn.pending, self.syn.pending.finally(() => {})];
			const dereferenced = self.syn.ref.deref();
			const fromCallback = [];
			self.syn.map.forEach((_held, _key, map) => fromCallback.push(map));
			const [passedOn, awaited, afterFinally] = await Promise.all(pending);
			return {
				passedOn: await outcome(() => {
					passedOn.n = 1;
				}),
				awaited: await outcome(() => {
					awaited.n = 2;
				}),
				afterFinally: await outcome(() => {
					afterFinally.n = 3;
				}),
				dereferenced: await outcome(() => {
					dereferenced.n = 4;
				}),
				callbackMap: await outcome(() => fromCallback[0].set("x", 1))
			};
		};
		const report = await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf("slothlet.test.i625.probe"));
		delete globalThis[Symbol.for("slothlet.test.i625.probe")];
		// Refused for not owning the path, or, under the live runtime, for having no module caller after an await.
		for (const outcome of Object.values(report)) expect(["LOOSE_SET_NOT_OWNED", "RUNTIME_NO_ACTIVE_CONTEXT_SELF"]).toContain(outcome);
		expect(value.n).toBe(0);
	});

	it("leaves what another module makes from them its own", async () => {
		await load({ permissions: {} });
		expect(await api.guest.x.useVictimDataCopies()).toEqual({
			unionAdd: "done",
			unionSize: 3,
			registryLookup: 1,
			registryGet: 1,
			sliceFill: "done"
		});
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("lets another module read and use them as plain JS does (permissions %s)", async (_label, options) => {
		await load(options);
		expect(await api.guest.x.readVictimData()).toEqual({
			mapGet: 1,
			mapHas: true,
			mapSize: 1,
			mapIsMap: true,
			mapSpread: "cfg",
			copied: 1,
			setHas: true,
			dateTime: 0,
			dateJson: JSON.stringify(new Date(0)),
			bufferLength: 8,
			bytes: "1,2,3",
			bytesSlice: "2,3",
			bytesIndex: 3,
			patternTest: true,
			patternSource: "x"
		});
	});

	it("denies another module reading them when a rule denies it the module", async () => {
		await load({ permissions: { rules: [{ caller: "guest.**", target: "victim.**", effect: "deny" }] } });
		expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.readVictimDataOutcome())).toBe("PERMISSION_DENIED");
	});

	it.each([
		["on", { permissions: {} }, "LOOSE_SET_NOT_OWNED", false],
		["off", {}, "done", true]
	])("holds a data object a module exports as a leaf to the same rule (permissions %s)", async (_label, options, change, changed) => {
		await load(options);
		const cache = new Map([["k", { n: 1 }]]);
		await api.slothlet.api.add("syn", { cache }, { moduleID: "syn" });
		expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeMapAt("syn.cache"))).toEqual({ read: 1, change });
		expect(cache.has("evil")).toBe(changed);
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("keeps what another module read live: it sees the owner's later changes (permissions %s)", async (_label, options) => {
		await load(options);
		const listKeys = api.guest.x.keepVictimCache();
		expect(listKeys()).toBe("cfg");
		api.victim.v.data.cache.set("later", 1);
		expect(listKeys()).toBe("cfg,later");
	});

	it("hands another module a view that native code refuses, and a copy of it that native code takes", async () => {
		await load({ permissions: {} });
		expect(await api.guest.x.victimBytesNative()).toEqual({ isView: false, copied: "1,2,3" });
	});

	it("hands a module a write rule grants the write the object itself", async () => {
		await load({ permissions: { rules: [{ caller: "guest.**", target: "victim.**:write", effect: "allow" }] } });
		expect(await api.guest.x.victimBytesNative()).toEqual({ isView: true, copied: "1,2,3" });
	});

	describe("each kind of data object", () => {
		it("can be changed by a module a write rule grants it", async () => {
			await load({ permissions: { rules: [{ caller: "guest.**", target: "victim.**:write", effect: "allow" }] } });
			const report = api.guest.x.changeEachVictimData();
			expect(report).toEqual(every(report, "done"));
			const data = api.victim.v.data;
			expect(data.cache.get("granted")).toBe(1);
			expect(data.tags.has("granted")).toBe(true);
			expect(data.when.getTime()).toBe(7);
			expect(data.buffer.byteLength).toBe(12);
			expect(data.bytes[0]).toBe(9);
			expect(data.pattern.lastIndex).toBe(1);
			expect(data.members.has("granted")).toBe(true);
			expect(data.registry.get("granted")).toBe(1);
		});

		it("cannot be changed by a module without the write", async () => {
			await load({ permissions: {} });
			const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeEachVictimData());
			expect(report).toEqual(every(report, "LOOSE_SET_NOT_OWNED"));
			expect(await api.victim.v.dataState()).toEqual(INITIAL);
			expect(api.victim.v.data.registry.has("granted")).toBe(false);
		});

		it("can be changed by any module with the permission system off", async () => {
			await load({});
			const report = api.guest.x.changeEachVictimData();
			expect(report).toEqual(every(report, "done"));
			const data = api.victim.v.data;
			expect(data.cache.get("granted")).toBe(1);
			expect(data.tags.has("granted")).toBe(true);
			expect(data.when.getTime()).toBe(7);
			expect(data.buffer.byteLength).toBe(12);
			expect(data.bytes[0]).toBe(9);
			expect(data.pattern.lastIndex).toBe(1);
			expect(data.members.has("granted")).toBe(true);
			expect(data.registry.get("granted")).toBe(1);
		});

		it("cannot be changed by a module a write rule denies", async () => {
			await load({ permissions: { rules: [{ caller: "guest.**", target: "victim.**:write", effect: "deny" }] } });
			const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeEachVictimData());
			expect(report).toEqual(every(report, "PERMISSION_DENIED"));
			expect(await api.victim.v.dataState()).toEqual(INITIAL);
		});

		it.each([
			["the module", "victim.**"],
			["its data", "victim.v.data.**"]
		])("cannot be read by a module a read rule denies %s", async (_label, target) => {
			await load({ permissions: { rules: [{ caller: "guest.**", target, effect: "deny" }] } });
			const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.readEachVictimData());
			expect(report).toEqual(every(report, "PERMISSION_DENIED"));
		});

		it.each([
			["on", { permissions: {} }],
			["off", {}]
		])(
			"is read live by a module without the write: what it kept follows every change the owner makes (permissions %s)",
			async (_label, options) => {
				await load(options);
				const report = api.guest.x.keepEachVictimData();
				expect(report()).toEqual({ map: "cfg", set: "a", date: 0, buffer: 8, bytes: "1,2,3", pattern: 0, members: 1 });
				const data = api.victim.v.data;
				data.cache.set("later", 1);
				data.tags.add("later");
				data.when.setTime(9);
				data.buffer.resize(16);
				data.bytes[1] = 8;
				data.pattern.lastIndex = 2;
				data.members.add({ n: 1 });
				expect(report()).toEqual({ map: "cfg,later", set: "a,later", date: 9, buffer: 16, bytes: "1,8,3", pattern: 2, members: 2 });
			}
		);
	});

	describe("less common routes", () => {
		/**
		 * Run `probe` as the guest module, with its `self`, and hand back what it returns.
		 * @param {function(object): *} probe - The probe.
		 * @returns {Promise<*>} What it returned.
		 */
		async function asGuest(probe) {
			globalThis[Symbol.for("slothlet.test.i625.probe")] = probe;
			try {
				return await withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf("slothlet.test.i625.probe"));
			} finally {
				delete globalThis[Symbol.for("slothlet.test.i625.probe")];
			}
		}

		/**
		 * Run `change`, reporting `"done"` or the error code it was refused with.
		 * @param {function(): *} change - The change.
		 * @returns {string} The outcome.
		 */
		const outcome = (change) => {
			try {
				change();
				return "done";
			} catch (error) {
				return error?.code ?? String(error);
			}
		};

		it.each([
			["on", { permissions: {} }, "LOOSE_SET_NOT_OWNED"],
			["off", {}, "done"]
		])(
			"holds a change made through a callback's this, another view as a set-like, or another view as a method's this to the same rule (permissions %s)",
			async (_label, options, expected) => {
				await load(options);
				const report = await asGuest((self) => {
					const d = self.victim.v.data;
					return {
						thisArgMap: outcome(() =>
							d.cache.forEach(function () {
								this.set("evil", 1);
							}, d.cache)
						),
						thisArgBytes: outcome(() =>
							d.bytes.forEach(function () {
								this[0] = 42;
							}, d.bytes)
						),
						setLike: outcome(() => {
							for (const entry of d.tags.union(d.members)) if (typeof entry === "object") entry.n = 9;
						}),
						methodThis: outcome(() => {
							d.registry.lookup.call(d.cache, "cfg").level = 9;
						})
					};
				});
				expect(report).toEqual(every(report, expected));
				if (expected === "done") expect(await api.victim.v.dataState()).not.toEqual(INITIAL);
				else expect(await api.victim.v.dataState()).toEqual(INITIAL);
			}
		);

		it.each([
			["on", { permissions: {} }, "LOOSE_SET_NOT_OWNED", { shared: 8, keys: "k", n: 0, bytes: "1,2", time: 0 }],
			["off", {}, "done", { shared: 16, keys: "k,evil", n: 9, bytes: "9,9", time: 9 }]
		])(
			"holds a SharedArrayBuffer and data objects of another realm to the same rule (permissions %s)",
			async (_label, options, change, after) => {
				await load(options);
				const shared = new SharedArrayBuffer(8, { maxByteLength: 16 });
				const foreign = vm.runInNewContext("({ map: new Map([['k', { n: 0 }]]), bytes: new Uint8Array([1, 2]), date: new Date(0) })");
				await api.slothlet.api.add("syn", { shared, foreign }, { moduleID: "syn" });
				const report = await asGuest((self) => ({
					sharedGrow: outcome(() => self.syn.shared.grow(16)),
					sharedRead: outcome(() => {
						if (self.syn.shared.slice(0).byteLength !== 8) throw new Error("WRONG_READ");
					}),
					foreignSet: outcome(() => self.syn.foreign.map.set("evil", 1)),
					foreignHeld: outcome(() => {
						self.syn.foreign.map.get("k").n = 9;
					}),
					foreignFill: outcome(() => self.syn.foreign.bytes.fill(9)),
					foreignDate: outcome(() => self.syn.foreign.date.setTime(9))
				}));
				expect(report).toEqual({
					sharedGrow: change,
					// Once the grow lands, the buffer reads back at its new length.
					sharedRead: change === "done" ? "Error: WRONG_READ" : "done",
					foreignSet: change,
					foreignHeld: change,
					foreignFill: change,
					foreignDate: change
				});
				expect(shared.byteLength).toBe(after.shared);
				expect([...foreign.map.keys()].join(",")).toBe(after.keys);
				expect(foreign.map.get("k").n).toBe(after.n);
				expect([...foreign.bytes].join(",")).toBe(after.bytes);
				expect(foreign.date.getTime()).toBe(after.time);
			}
		);

		it.each([
			["on", { permissions: {} }],
			["off", {}]
		])(
			"keeps iterators and property lookups working as plain JS for a reader without the write (permissions %s)",
			async (_label, options) => {
				await load(options);
				const report = await asGuest((self) => {
					const d = self.victim.v.data;
					const keys = d.cache.keys();
					return {
						helpers: typeof Iterator === "function" ? d.cache.values().toArray().length : 1,
						tag: Object.prototype.toString.call(keys),
						lookupGetter: outcome(() => d.cache.__lookupGetter__("size"))
					};
				});
				expect(report).toEqual({ helpers: 1, tag: "[object Map Iterator]", lookupGetter: "done" });
			}
		);
	});

	it("lets the owning module change them through self", async () => {
		await load({ permissions: {} });
		const report = await api.victim.v.changeOwnData();
		expect(report).toEqual(every(report, "done"));
	});

	it("lets another module change them when a write rule grants it", async () => {
		await load({ permissions: { rules: [{ caller: "guest.**", target: "victim.**:write", effect: "allow" }] } });
		const report = api.guest.x.changeVictimData();
		expect(report.mapSet).toBe("done");
		expect(report.bytesIndex).toBe("done");
		expect(report.dateSet).toBe("done");
	});
});
