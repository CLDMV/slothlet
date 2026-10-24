/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-data-objects.test.vitest.mjs
 *	@Date: 2026-10-24T04:21:35-07:00 (1792840895)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-24T09:44:58-07:00 (1792860298)
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

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("refuses another module changing them, and leaves them as they were (permissions %s)", async (_label, options) => {
		await load(options);
		const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimData());
		expect(report).toEqual(every(report, "LOOSE_SET_NOT_OWNED"));
		expect(await api.victim.v.dataState()).toEqual(INITIAL);
	});

	it.each([
		["on", { permissions: {} }],
		["off", {}]
	])("refuses another module changing them by any other route, and leaves them as they were (permissions %s)", async (_label, options) => {
		await load(options);
		const report = withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeVictimDataByRoute());
		expect(report).toEqual(every(report, "LOOSE_SET_NOT_OWNED"));
		expect(await api.victim.v.dataState()).toEqual(INITIAL);
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
		["on", { permissions: {} }],
		["off", {}]
	])("holds a data object a module exports as a leaf to the same rule (permissions %s)", async (_label, options) => {
		await load(options);
		const cache = new Map([["k", { n: 1 }]]);
		await api.slothlet.api.add("syn", { cache }, { moduleID: "syn" });
		expect(withSuppressedSlothletErrorOutputSync(() => api.guest.x.changeMapAt("syn.cache"))).toEqual({
			read: 1,
			change: "LOOSE_SET_NOT_OWNED"
		});
		expect(cache.has("evil")).toBe(false);
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
