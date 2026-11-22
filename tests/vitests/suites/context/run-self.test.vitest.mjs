/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-self.test.vitest.mjs
 *	@Date: 2026-11-21T22:19:37-08:00 (1795328377)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T22:25:14-08:00 (1795328714)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.context.run.self(contextData, fn, ...args)` and `scope({ …, self: true })` call `fn` with
 * the run's own view first: what module code's `self` resolves to inside that run. A change made through the view
 * (an assignment, a definition, a deletion, closing a node, setting its prototype) stays in the run under the default
 * `"full"` isolation, before and after the run has a tree of its own, while a write through `api` in the same callback
 * reaches the instance. Plain `run()` and `scope()` are unchanged: a function reference is called with the arguments
 * given and nothing in front of them.
 *
 * Each expected value is what plain JavaScript answers, or what the same change made through a module's `self` in the
 * same run answers.
 *
 * Fixture (written at run time): `api/math.mjs` (`add`, `count`); `api/owner.mjs` (data members `cfg`, `extra`);
 * `mod/mod.mjs`, added under `mod` so it owns only `mod.*`, opens runs from module code and writes through `self` and
 * through a view it is handed; `more/more.mjs` is a folder a run adds.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-self");
const BASE = path.join(ROOT, "api");
const MORE = path.join(ROOT, "more");
const MOD = path.join(ROOT, "mod");

/**
 * Write a fixture file.
 * @param {string} file - Path under ROOT.
 * @param {string[]} lines - Its lines.
 * @returns {void}
 */
function write(file, lines) {
	writeFileSync(path.join(ROOT, file), lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(BASE, { recursive: true });
	mkdirSync(MORE, { recursive: true });
	mkdirSync(MOD, { recursive: true });
	const RUNTIME = 'import { self } from "@cldmv/slothlet/runtime";';
	const TRY = "const tryIt = (f) => { try { return f(); } catch (e) { return 'ERR:' + (e.code || e.constructor.name); } };";
	write("api/math.mjs", [
		"export function add(a, b) {",
		"\treturn a + b;",
		"}",
		"export function count(...args) {",
		"\treturn args.length;",
		"}"
	]);
	write("api/owner.mjs", ["export const cfg = { a: 1 };", 'export const extra = "E";']);
	write("mod/mod.mjs", [
		RUNTIME,
		TRY,
		"export function viaRunSelf(...extra) {",
		"\treturn self.slothlet.context.run.self({ who: 'mod' }, (view, ...got) => ({ same: view === self, got }), ...extra);",
		"}",
		"export function viaScopeSelf(isolation) {",
		"\treturn self.slothlet.context.scope({ context: {}, isolation, self: true, args: [1, 2], fn: (view, ...got) => ({ same: view === self, got }) });",
		"}",
		"export function viaRun() {",
		"\treturn self.slothlet.context.run({}, (...got) => got.length);",
		"}",
		"export function writeThroughView() {",
		"\treturn self.slothlet.context.run.self({}, (view) => { view.mod.jot = 'run'; return view.mod.jot; });",
		"}",
		"export function memo() {",
		"\treturn self.mod.jot;",
		"}",
		"export function selfWrite(key, value) {",
		"\tself.mod[key] = value;",
		"\treturn self.mod[key];",
		"}",
		"export function viewWrite(view) {",
		"\treturn tryIt(() => { view.owner.cfg = 9; return 'ok'; });",
		"}",
		"export function ownWrite() {",
		"\treturn tryIt(() => { self.owner.cfg = 9; return 'ok'; });",
		"}"
	]);
	write("more/more.mjs", ["export function ping() {", '\treturn "more";', "}"]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * The error code `fn` throws or rejects with, or "ok".
 * @param {Function} fn - The code.
 * @returns {Promise<string>} The code.
 */
async function codeOf(fn) {
	try {
		await fn();
		return "ok";
	} catch (error) {
		return error.code;
	}
}

/**
 * Let a few macrotasks pass: a run's copy is torn down on one once the run's work has finished.
 * @returns {Promise<void>}
 */
async function idle() {
	for (let index = 0; index < 4; index++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Make every change the spec names through a view: an assignment at the top and below a node, a definition, a
 * deletion, setting a node's prototype and closing a node.
 * @param {object} view - The run's view.
 * @returns {object} What the view answers right after.
 */
function changeThrough(view) {
	view.top = "run";
	view.owner.added = "run";
	Object.defineProperty(view, "defined", { value: "run", enumerable: true, configurable: true, writable: true });
	delete view.owner.extra;
	Object.setPrototypeOf(view.owner, { inherited: "P" });
	Object.freeze(view.owner.cfg);
	return {
		top: view.top,
		added: view.owner.added,
		defined: view.defined,
		extra: "extra" in view.owner,
		inherited: view.owner.inherited,
		frozen: Object.isFrozen(view.owner.cfg)
	};
}

/** What a view answers after {@link changeThrough}. */
const CHANGED = { top: "run", added: "run", defined: "run", extra: false, inherited: "P", frozen: true };

/**
 * What the instance shows of the changes {@link changeThrough} names.
 * @param {object} api - The instance's api.
 * @returns {object} Its answers.
 */
function instanceState(api) {
	return {
		top: "top" in api,
		added: "added" in api.owner,
		defined: "defined" in api,
		extra: api.owner.extra,
		inherited: api.owner.inherited,
		frozen: Object.isFrozen(api.owner.cfg),
		extensible: Object.isExtensible(api)
	};
}

/** The instance untouched by a run. */
const UNTOUCHED = { top: false, added: false, defined: false, extra: "E", inherited: undefined, frozen: false, extensible: true };

describe.each([
	["async", "eager"],
	["async", "lazy"],
	["live", "eager"],
	["live", "lazy"]
])("run.self and scope self — %s runtime, %s mode", (runtime, mode) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	describe.each([
		["permissions none", undefined],
		["permissions off", { mode: "off" }],
		["permissions on", { mode: "on" }]
	])("%s", (_label, permissions) => {
		/**
		 * Make an instance on the fixture.
		 * @param {object} [extra] - More config.
		 * @returns {Promise<object>} The api.
		 */
		async function make(extra = {}) {
			api = await slothlet({ base: BASE, runtime, mode, silent: true, ...(permissions ? { permissions } : {}), ...extra });
			await api.slothlet.api.add("mod", MOD);
			// Load the lazy nodes the tests read.
			await api.owner.extra;
			return api;
		}

		it("leaves plain run() as it is: a function reference is called with the arguments given", async () => {
			await make();
			expect(await api.slothlet.context.run({}, api.math.add, 2, 3)).toBe(5);
			expect(await api.slothlet.context.run({}, api.math.count, 2, 3)).toBe(2);
			expect(await api.slothlet.context.scope({ context: {}, fn: api.math.count, args: [2, 3] })).toBe(2);
			expect(await api.slothlet.context.scope({ context: {}, fn: api.math.count, args: [2, 3], self: false })).toBe(2);
			expect(await api.mod.viaRun()).toBe(0);
		});

		it("calls fn with the view first, then the arguments, and returns what fn returns", async () => {
			await make();
			const seen = await api.slothlet.context.run.self(
				{ user: 7 },
				(view, a, b) => ({ type: typeof view, a, b, user: api.slothlet.context.get("user") }),
				2,
				3
			);
			expect(seen).toEqual({ type: "object", a: 2, b: 3, user: 7 });
			const scoped = await api.slothlet.context.scope({ context: { user: 8 }, self: true, args: [4], fn: (view, a) => [typeof view, a] });
			expect(scoped).toEqual(["object", 4]);
			expect(await api.slothlet.context.run.self({}, async () => "async")).toBe("async");
		});

		it("refuses what run() refuses, with the same errors", async () => {
			await make();
			const run = api.slothlet.context.run;
			for (const args of [
				[null, () => 1],
				["x", () => 1],
				[{}, "notfn"],
				[{}, undefined]
			]) {
				expect(await codeOf(() => run.self(...args))).toBe(await codeOf(() => run(...args)));
			}
			expect(await codeOf(() => run.self({}, () => 1))).toBe("ok");
			const boom = new Error("boom");
			await expect(
				run.self({}, () => {
					throw boom;
				})
			).rejects.toBe(boom);
		});

		it("refuses a self option that is not a boolean", async () => {
			await make();
			for (const self of ["yes", 1, null, {}]) {
				let error;
				try {
					await api.slothlet.context.scope({ context: {}, self, fn: () => 1 });
				} catch (thrown) {
					error = thrown;
				}
				expect(error?.code).toBe("INVALID_ARGUMENT");
				expect(error.details.argument).toBe("self");
			}
		});

		it("is refused as run() is when scope is off", async () => {
			await make({ scope: false });
			expect(await codeOf(() => api.slothlet.context.run.self({}, () => 1))).toBe("SCOPE_DISABLED");
		});

		it("keeps every change through the view in the run, while a write through api reaches the instance", async () => {
			await make();
			const seen = await api.slothlet.context.run.self({}, (view) => {
				const changed = changeThrough(view);
				api.hostWrite = "instance";
				return changed;
			});
			expect(seen).toEqual(CHANGED);
			expect(instanceState(api)).toEqual(UNTOUCHED);
			expect(api.hostWrite).toBe("instance");
		});

		it("keeps the view's changes in the run once the run has a tree of its own", async () => {
			await make();
			const seen = await api.slothlet.context.run.self({}, async (view) => {
				view.early = "run";
				await api.slothlet.api.add("more", MORE);
				const changed = changeThrough(view);
				return { ...changed, early: view.early, more: await view.more.ping(), extensible: Object.isExtensible(view) };
			});
			expect(seen).toEqual({ ...CHANGED, early: "run", more: "more", extensible: true });
			expect(instanceState(api)).toEqual(UNTOUCHED);
			expect("early" in api).toBe(false);
			expect("more" in api).toBe(false);
		});

		it("keeps closing the root view in the run", async () => {
			await make();
			const closed = await api.slothlet.context.run.self({}, async (view) => {
				Object.preventExtensions(view);
				return Object.isExtensible(view);
			});
			expect(closed).toBe(false);
			expect(Object.isExtensible(api)).toBe(true);
			await api.slothlet.api.add("more", MORE);
			expect(await api.more.ping()).toBe("more");
		});

		it("answers as a module's self does in the same run, under either isolation", async () => {
			for (const isolation of ["full", "partial"]) {
				await make();
				const seen = await api.slothlet.context.scope({
					context: {},
					isolation,
					self: true,
					fn: async (view) => {
						view.mod.fromView = "v";
						const fromSelf = await api.mod.selfWrite("fromSelf", "s");
						return {
							view: view.mod.fromView,
							viewSeesSelf: view.mod.fromSelf,
							fromSelf,
							selfSeesView: await api.mod.selfWrite("again", view.mod.fromView)
						};
					}
				});
				expect(seen).toEqual({ view: "v", viewSeesSelf: "s", fromSelf: "s", selfSeesView: "v" });
				// Whatever reaches the instance from the module's self reaches it from the view, and nothing else.
				expect("fromView" in api.mod).toBe("fromSelf" in api.mod);
				expect("fromView" in api.mod).toBe(isolation === "partial");
				await api.slothlet.shutdown();
				api = null;
			}
		});

		it("hands module code its own self as the view", async () => {
			await make();
			expect(await api.mod.viaRunSelf("x", "y")).toEqual({ same: true, got: ["x", "y"] });
			expect(await api.mod.viaScopeSelf("full")).toEqual({ same: true, got: [1, 2] });
			expect(await api.mod.viaScopeSelf("partial")).toEqual({ same: true, got: [1, 2] });
			expect(await api.mod.writeThroughView()).toBe("run");
			expect(await api.mod.memo()).toBeUndefined();
		});

		it("gives each nested run its own view", async () => {
			await make();
			const seen = await api.slothlet.context.run.self({}, async (outer) => {
				outer.level = "outer";
				const inner = await api.slothlet.context.run.self({}, (view) => {
					const before = view.level;
					view.level = "inner";
					return { distinct: view !== outer, before, after: view.level };
				});
				return { ...inner, outer: outer.level };
			});
			expect(seen).toEqual({ distinct: true, before: "outer", after: "inner", outer: "outer" });
			expect("level" in api).toBe(false);
		});

		it("answers a view kept after the run from the instance's tree once the run's copy is torn down", async () => {
			await make();
			const kept = await api.slothlet.context.run.self({}, async (view) => {
				await api.slothlet.api.add("more", MORE);
				view.owner.added = "run";
				return view;
			});
			await idle();
			expect(runCopyCounts()).toEqual({ runs: 0, held: 0, readThrough: 0 });
			expect(kept.owner.extra).toBe(api.owner.extra);
			expect(kept.owner.added).toBe(api.owner.added);
			expect(kept.owner.added).toBeUndefined();
		});
	});

	describe("with permissions on", () => {
		it("holds a module to its own rights when the host hands it a view", async () => {
			api = await slothlet({ base: BASE, runtime, mode, silent: true, permissions: { mode: "on" } });
			await api.slothlet.api.add("mod", MOD);
			const own = await api.mod.ownWrite();
			expect(own).toBe("ERR:LOOSE_SET_NOT_OWNED");
			const seen = await api.slothlet.context.run.self({}, async (view) => {
				const handed = await api.mod.viewWrite(view);
				view.owner.hostWrite = "host";
				return { handed, host: view.owner.hostWrite };
			});
			expect(seen).toEqual({ handed: own, host: "host" });
			expect(api.owner.cfg).toEqual({ a: 1 });
		});

		it("refuses run.self to a module exactly when a rule refuses it run", async () => {
			api = await slothlet({
				base: BASE,
				runtime,
				mode,
				silent: true,
				permissions: { mode: "on", rules: [{ caller: "mod.**", target: "slothlet.context.run", effect: "deny" }] }
			});
			await api.slothlet.api.add("mod", MOD);
			expect(await codeOf(() => api.mod.viaRun())).toBe("PERMISSION_DENIED");
			expect(await codeOf(() => api.mod.viaRunSelf())).toBe("PERMISSION_DENIED");
		});

		it("allows run.self to a module exactly when a rule allows it run", async () => {
			api = await slothlet({
				base: BASE,
				runtime,
				mode,
				silent: true,
				permissions: { mode: "on", policy: "deny", rules: [{ caller: "mod.**", target: "slothlet.context.run", effect: "allow" }] }
			});
			await api.slothlet.api.add("mod", MOD);
			expect(await codeOf(() => api.mod.viaRun())).toBe("ok");
			expect(await codeOf(() => api.mod.viaRunSelf())).toBe("ok");
		});
	});
});
