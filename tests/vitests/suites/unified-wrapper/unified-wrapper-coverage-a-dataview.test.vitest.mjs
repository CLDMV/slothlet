/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-dataview.test.vitest.mjs
 *	@Date: 2026-11-25T01:20:47-08:00 (1795598447)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:13:00-08:00 (1795601580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview How another module sees a module's data objects (a `Map`, a typed array, a `DataView`) through `self`
 * when it may not change them: the view answers the language's own questions about the object as the object does —
 * its own members, fixed or not, whether it is closed to extension, what it inherits from — and holds every change to
 * the rule of the path it was read at.
 *
 * Fixtures: `api_tests/api_test_self_write_reach` (base) and its `guest` module, whose `runWithSelf` runs a probe as
 * that module.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothletInstance from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput, apiPart } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const PROBE = "slothlet.test.uwa.dataview.probe";

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the error code (or name) it was refused with.
 */
function attempt(change) {
	try {
		change();
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

describe.each(CONFIGS)("data object views through self — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		delete globalThis[Symbol.for(PROBE)];
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the base module and `guest`, with the permission system on, and add `syn` holding `values`.
	 * @param {object} values - What `syn` exports.
	 * @param {object[]} [rules] - Permission rules.
	 * @returns {Promise<object>} The api.
	 */
	async function load(values, rules = []) {
		api = await slothletInstance({
			base: apiPart(FIXTURE),
			mode,
			runtime,
			silent: true,
			permissions: { caller: { provenance: false }, rules }
		});
		await api.slothlet.api.add("guest", apiPart(FIXTURE, "guest"), { id: "guest" });
		await api.slothlet.api.add("syn", values, { id: "syn" });
		return api;
	}

	/**
	 * Run `probe` as the guest module, handed its `self`.
	 * @param {function(object): *} probe - The probe.
	 * @returns {Promise<*>} What it returned.
	 */
	function asGuest(probe) {
		globalThis[Symbol.for(PROBE)] = probe;
		return withSuppressedSlothletErrorOutput(() => api.guest.x.runWithSelf(PROBE));
	}

	it("answers a map closed to extension as the map does, before and after its owner deletes a member", async () => {
		const map = new Map([["k", { n: 1 }]]);
		map.extra = { n: 2 };
		Object.preventExtensions(map);
		await load({ map });
		const first = await asGuest((self) => {
			const view = self.syn.map;
			return {
				got: view.get("k").n,
				extensible: Object.isExtensible(view),
				has: "extra" in view,
				keys: Reflect.ownKeys(view),
				extra: Object.getOwnPropertyDescriptor(view, "extra").value.n,
				isMap: view instanceof Map,
				close: attempt(() => Object.preventExtensions(view)),
				write: attempt(() => {
					view.extra = 1;
				})
			};
		});
		expect(first).toEqual({
			got: 1,
			extensible: false,
			has: true,
			keys: ["extra"],
			extra: 2,
			isMap: true,
			close: "done",
			write: "LOOSE_SET_NOT_OWNED"
		});
		delete map.extra;
		const second = await asGuest((self) => {
			const view = self.syn.map;
			return {
				has: "extra" in view,
				keys: Reflect.ownKeys(view),
				extra: Object.getOwnPropertyDescriptor(view, "extra"),
				isMap: Object.getPrototypeOf(view) === Map.prototype || view instanceof Map
			};
		});
		expect(second).toEqual({ has: false, keys: [], extra: undefined, isMap: true });
	});

	it("lets a reader freeze a map already frozen, which changes nothing, as on the map itself", async () => {
		const map = Object.freeze(Object.assign(new Map([["k", 1]]), { extra: { n: 2 } }));
		await load({ map });
		const report = await asGuest((self) => {
			const view = self.syn.map;
			return {
				freeze: attempt(() => Object.freeze(view)),
				frozen: Object.isFrozen(view),
				extra: view.extra.n,
				add: attempt(() => view.set("x", 1))
			};
		});
		expect(report).toEqual({ freeze: "done", frozen: true, extra: 2, add: "LOOSE_SET_NOT_OWNED" });
		expect(map.has("x")).toBe(false);
	});

	it("reports a fixed member of an open map as fixed, and its value read through the view", async () => {
		const map = new Map();
		Object.defineProperty(map, "fixed", { value: { n: 1 }, enumerable: true });
		await load({ map });
		const report = await asGuest((self) => {
			const view = self.syn.map;
			const before = Object.getOwnPropertyDescriptor(view, "fixed");
			const again = Object.getOwnPropertyDescriptor(view, "fixed");
			return {
				writable: before.writable,
				configurable: before.configurable,
				same: again === again && again.value.n,
				read: view.fixed.n,
				missing: Object.getOwnPropertyDescriptor(view, "missing"),
				change: attempt(() => {
					view.fixed.n = 2;
				})
			};
		});
		expect(report).toEqual({ writable: false, configurable: false, same: 1, read: 1, missing: undefined, change: "LOOSE_SET_NOT_OWNED" });
		expect(map.fixed.n).toBe(1);
	});

	it("lands a write through an object inheriting from the view on that object, as plain JS does", async () => {
		const map = new Map();
		await load({ map });
		const report = await asGuest((self) => {
			const child = Object.create(self.syn.map);
			child.note = "mine";
			return { own: Object.hasOwn(child, "note"), note: child.note };
		});
		expect(report).toEqual({ own: true, note: "mine" });
		expect(Object.hasOwn(map, "note")).toBe(false);
	});

	it("hands back what a map's iterator yields viewed, and closes or throws into it", async () => {
		const map = new Map([["k", { n: 1 }]]);
		await load({ map });
		const iteratorPrototype = Object.getPrototypeOf(new Map().entries());
		iteratorPrototype.return = function (value) {
			return { value, done: true, closed: true };
		};
		try {
			const report = await asGuest((self) => {
				const entries = self.syn.map.entries();
				const [key, value] = entries.next().value;
				const closed = entries.return("bye");
				let thrown = null;
				try {
					self.syn.map.values().throw(new Error("into"));
				} catch (error) {
					thrown = error.message;
				}
				return {
					key,
					n: value.n,
					tag: Object.prototype.toString.call(entries),
					closed,
					thrown,
					change: attempt(() => {
						value.n = 9;
					})
				};
			});
			expect(report).toEqual({
				key: "k",
				n: 1,
				tag: "[object Map Iterator]",
				closed: { value: "bye", done: true, closed: true },
				thrown: "into",
				change: "LOOSE_SET_NOT_OWNED"
			});
		} finally {
			delete iteratorPrototype.return;
		}
		expect(map.get("k").n).toBe(1);
	});

	it("holds a typed array's shared buffer and a subarray of it to the rule, and hands a copy over as the reader's own", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		await load({ bytes });
		const report = await asGuest((self) => {
			const view = self.syn.bytes;
			const sub = view.subarray(1);
			const copy = view.slice();
			return {
				sub: [...sub],
				bufferLength: view.buffer.byteLength,
				subFill: attempt(() => sub.fill(0)),
				copyFill: attempt(() => copy.fill(0)),
				copy: [...copy]
			};
		});
		expect(report).toEqual({ sub: [2, 3], bufferLength: 3, subFill: "LOOSE_SET_NOT_OWNED", copyFill: "done", copy: [0, 0, 0] });
		expect([...bytes]).toEqual([1, 2, 3]);
	});

	it("lets a reader read a DataView and refuses it a change", async () => {
		const data = new DataView(new ArrayBuffer(4));
		data.setInt8(0, 7);
		await load({ data });
		const report = await asGuest((self) => {
			const view = self.syn.data;
			return { read: view.getInt8(0), write: attempt(() => view.setInt8(0, 1)) };
		});
		expect(report).toEqual({ read: 7, write: "LOOSE_SET_NOT_OWNED" });
		expect(data.getInt8(0)).toBe(7);
	});

	it("lets a reader granted the write of one member of a map it may not change write that member", async () => {
		const map = new Map();
		await load({ map }, [{ caller: "guest.**", target: "syn.map.note:write", effect: "allow" }]);
		const report = await asGuest((self) => {
			const view = self.syn.map;
			return {
				note: attempt(() => {
					view.note = "granted";
				}),
				other: attempt(() => {
					view.other = 1;
				}),
				read: view.note
			};
		});
		expect(report).toEqual({ note: "done", other: "LOOSE_SET_NOT_OWNED", read: "granted" });
		expect(map.note).toBe("granted");
	});
});
