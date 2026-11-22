/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-write-copies.test.vitest.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T00:00:00-08:00 (1795248000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a full-isolation run changes through `self` or `api` stays in the run's copy: members set,
 * defined and deleted on plain objects, class instances and emitters, array writes (`[i] =`, `push`, `length =`),
 * `obj.__proto__ =`, and writes to a function's members. The run reads what it wrote, as plain JS reads it (an array is
 * an array, a method or getter sees the run's write and its own writes stay in the run), and once the run ends the
 * instance, and the module's own values, are as they were. The same holds once the run has a tree of its own
 * (`api.slothlet.api.add()` in the run), and in lazy mode for a node the run is the first to reach. Under
 * `isolation: "partial"` and outside any run the writes are kept, as before.
 *
 * @description
 * Every snippet runs once in module code (`writer`, through its `self`) and once on a plain-JS twin of the module's
 * values (`lib/values.mjs`); the twin's answers are the expected ones. After the run, the same read on a fresh twin is
 * what the instance must answer, and the module's own values must be as made.
 *
 * Fixture: `api_tests/api_test_run_write_copies`.
 */
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";
import { makeValues, stateOf } from "../../../../api_tests/api_test_run_write_copies/lib/values.mjs";

const FIXTURE = path.resolve(TEST_DIRS.API_TEST_SELF_WRITE_REACH, "..", "api_test_run_write_copies");
const BASE = path.join(FIXTURE, "api");
const EXTRA = path.join(FIXTURE, "extra");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

// name → [the write and what it reads back, the read made after the run]
const WRITES = {
	setMember: ["(self.data.cfg.n = 2, self.data.cfg.n)", "self.data.cfg.n"],
	setNested: ["(self.data.cfg.nested.a = 2, self.data.cfg.nested.a)", "self.data.cfg.nested.a"],
	deleteNested: ["(delete self.data.cfg.nested.a, ['a' in self.data.cfg.nested, self.data.cfg.nested.a])", "'a' in self.data.cfg.nested"],
	define: [
		"(Object.defineProperty(self.data.cfg, 'd', { value: 3, writable: true, enumerable: true, configurable: true }), self.data.cfg.d)",
		"'d' in self.data.cfg"
	],
	newObject: ["(self.data.cfg.fresh = { k: { d: 1 } }, self.data.cfg.fresh.k.d)", "'fresh' in self.data.cfg"],
	objectMember: ["(self.data.obj.x = 8, self.data.obj.x)", "self.data.obj.x"],
	methodSeesWrite: ["(self.data.obj.x = 8, [self.data.obj.x, self.data.obj.method(), self.data.obj.twice])", "self.data.obj.x"],
	methodWrites: ["[self.data.obj.bump(), self.data.obj.x, self.data.obj.method(), self.data.obj.twice]", "self.data.obj.x"],
	instanceField: ["(self.data.inst.field = 5, [self.data.inst.field, self.data.inst.label()])", "self.data.inst.field"],
	instanceOwn: ["(self.data.inst.size = 4, [self.data.inst.size, self.data.inst.label()])", "self.data.inst.size"],
	instanceDelete: [
		"(delete self.data.inst.size, ['size' in self.data.inst, self.data.inst.size, self.data.inst.label()])",
		"self.data.inst.size"
	],
	isArray: ["Array.isArray(self.data.cfg.list)", "Array.isArray(self.data.cfg.list)"],
	arrayIndex: ["(self.data.cfg.list[0] = 9, [self.data.cfg.list[0], self.data.cfg.list.length])", "self.data.cfg.list[0]"],
	arrayPush: [
		"(self.data.cfg.list.push(3), [self.data.cfg.list.length, [...self.data.cfg.list], self.data.cfg.list[2]])",
		"self.data.cfg.list.length"
	],
	arrayLength: [
		"(self.data.cfg.list.length = 1, [self.data.cfg.list.length, self.data.cfg.list[1], 1 in self.data.cfg.list, Object.keys(self.data.cfg.list)])",
		"self.data.cfg.list.length"
	],
	topArrayPush: ["(self.data.list2.push(3), [self.data.list2.length, self.data.list2.join('-')])", "self.data.list2.join('-')"],
	protoAssign: ["(self.data.obj2.__proto__ = { viaProto: 1 }, self.data.obj2.viaProto)", "self.data.obj2.viaProto"],
	functionMember: ["(self.data.fn.extra = 'changed', self.data.fn.extra)", "self.data.fn.extra"],
	frozenRefused: [
		"((f) => [Reflect.deleteProperty(f, 'a'), f.a, Object.keys(f), Reflect.defineProperty(f, 'a', { value: 2 }), f.a, Reflect.defineProperty(f, 'y', { value: 2, configurable: true }), 'y' in f])(self.data.frozenCfg)",
		"self.data.frozenCfg.a"
	]
};

// Writes made in lazy mode before the run has reached the node (no read of the value back: a node not loaded yet
// answers a sync read with its loading stand-in).
const COLD_WRITES = {
	setMember: ["(self.data.cfg.n = 2, 0)", "self.data.cfg.n"],
	setNested: ["(self.data.cfg.nested.a = 2, 0)", "self.data.cfg.nested.a"],
	deleteNested: ["(delete self.data.cfg.nested.a, 0)", "'a' in self.data.cfg.nested"],
	objectMember: ["(self.data.obj.x = 8, 0)", "self.data.obj.x"],
	functionMember: ["(self.data.fn.extra = 'changed', 0)", "self.data.fn.extra"]
};

/**
 * Run `src` on a fresh plain-JS twin of the module's values.
 * @param {string} src - The expression.
 * @returns {*} Its value.
 */
function plain(src) {
	return new Function("self", `return (${src});`)({ data: makeValues() });
}

/**
 * Run `src` as the host's code with `api` in scope.
 * @param {object} api - The api.
 * @param {string} src - The expression.
 * @returns {*} Its value.
 */
function asHost(api, src) {
	return new Function("self", `return (${src});`)(api);
}

describe.each(CONFIGS)("full-isolation run keeps its writes in its own copy — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the fixture.
	 * @param {boolean} [warm=true] - Whether to load the `data` module first.
	 * @returns {Promise<object>} The api.
	 */
	async function load(warm = true) {
		api = await slothlet({ base: BASE, mode, runtime, silent: true });
		if (warm) await api.writer.evalIn("1");
		return api;
	}

	/**
	 * Expect the instance, and the module's own values, to be as the module made them.
	 * @param {string} read - The read made after the run.
	 * @returns {Promise<void>}
	 */
	async function expectInstanceUnchanged(read) {
		expect(await api.writer.evalIn(read)).toEqual(plain(read));
		expect(await api.data.raw()).toEqual(stateOf(makeValues()));
	}

	describe.each(Object.entries(WRITES))("%s", (_name, [write, read]) => {
		it("module code in a run reads its write as plain JS does, and the instance keeps its values", async () => {
			await load();
			const seen = await api.slothlet.context.run({}, () => api.writer.evalIn(write));
			expect(seen).toEqual(plain(write));
			await expectInstanceUnchanged(read);
		});

		it("module code in a run with a tree of its own reads its write as plain JS does, and the instance keeps its values", async () => {
			await load();
			const seen = await api.slothlet.context.run({}, async () => {
				await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
				return api.writer.evalIn(write);
			});
			expect(seen).toEqual(plain(write));
			await expectInstanceUnchanged(read);
		});

		it("the host's code through api in a run with a tree of its own reads its write as plain JS does, and the instance keeps its values", async () => {
			await load();
			const seen = await api.slothlet.context.run({}, async () => {
				await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
				await api.data.fn(1, 2);
				return asHost(api, write);
			});
			expect(seen).toEqual(plain(write));
			await expectInstanceUnchanged(read);
		});

		it("a later run starts from the instance's values", async () => {
			await load();
			await api.slothlet.context.run({}, async () => {
				await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
				return api.writer.evalIn(write);
			});
			const later = await api.slothlet.context.run({}, () => api.writer.evalIn(read));
			expect(later).toEqual(plain(read));
		});
	});

	describe.each(Object.entries(COLD_WRITES))("%s on a node the run reaches first", (_name, [write, read]) => {
		it("module code's write in a run stays in the run", async () => {
			await load(false);
			await api.slothlet.context.run({}, async () => {
				api.writer.evalCold(write);
				await api.writer.evalIn("1");
			});
			await expectInstanceUnchanged(read);
		});
	});

	describe("an emitter is a live object the run shares with the instance", () => {
		it("a member module code in a run sets on an emitter reaches the instance, as on the shared object in plain JS", async () => {
			await load();
			const write = "(self.data.bus.flag = 1, self.data.bus.flag)";
			const seen = await api.slothlet.context.run({}, () => api.writer.evalIn(write));
			// One object shared by the run and the instance: the plain-JS twin's answer, and the instance then holds the write.
			const shared = makeValues();
			expect(seen).toEqual(new Function("self", `return (${write});`)({ data: shared }));
			expect(await api.writer.evalIn("self.data.bus.flag")).toBe(shared.bus.flag);
			expect((await api.data.raw()).busFlag).toBe(shared.bus.flag);
		});
	});

	describe("isolation: partial and outside a run", () => {
		it("a write under isolation partial is kept, as before", async () => {
			await load();
			await api.slothlet.context.scope({ context: {}, isolation: "partial", fn: () => api.writer.evalIn("self.data.cfg.n = 2") });
			expect(await api.writer.evalIn("self.data.cfg.n")).toBe(2);
		});

		it("an array write under isolation partial is kept, as before", async () => {
			await load();
			await api.slothlet.context.scope({ context: {}, isolation: "partial", fn: () => api.writer.evalIn("self.data.cfg.list.push(3)") });
			expect(await api.writer.evalIn("self.data.cfg.list.length")).toBe(3);
		});

		it("a write outside a run is kept", async () => {
			await load();
			await api.writer.evalIn("self.data.obj.x = 8");
			expect(await api.writer.evalIn("[self.data.obj.x, self.data.obj.method()]")).toEqual([8, 8]);
		});
	});

	describe.each([
		["an object root", "objroot"],
		["a function root", "fnroot"]
	])("the host's changes to %s in a run with a tree of its own", (_label, root) => {
		const ROOTS = path.resolve(FIXTURE, "..", "api_test_api_root_integrity");

		/**
		 * Load the root fixture.
		 * @returns {Promise<object>} The api.
		 */
		async function loadRoot() {
			api = await slothlet({ base: path.join(ROOTS, root), mode, runtime, silent: true });
			return api;
		}

		it.each(["full", "partial"])("closing api in a run (isolation %s) leaves the instance's root open", async (isolation) => {
			await loadRoot();
			await api.slothlet.context.scope({
				context: {},
				isolation,
				fn: async () => {
					await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
					Reflect.preventExtensions(api);
				}
			});
			expect(Object.isExtensible(api)).toBe(true);
			api.hostMember = 1;
			expect(api.hostMember).toBe(1);
			await api.slothlet.api.add("later", EXTRA, { id: "later" });
			expect("later" in api).toBe(true);
		});

		it("a prototype the instance's root was given is kept by the run's copy and by the instance", async () => {
			await loadRoot();
			const proto = { inherited: 5 };
			Object.setPrototypeOf(api, proto);
			const seen = await api.slothlet.context.run({}, async () => {
				await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
				return [api.inherited, "inherited" in api];
			});
			expect(seen).toEqual([5, true]);
			expect(api.inherited).toBe(5);
			expect(Object.getPrototypeOf(api)).toBe(proto);
		});
	});
});
