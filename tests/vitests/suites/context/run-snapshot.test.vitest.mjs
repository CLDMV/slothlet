/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T00:00:00-08:00 (1795334400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()` runs on a snapshot of the instance as of the moment the run starts: the values
 * reachable through the tree (plain objects and arrays, a `Map`, `Set`, `Date`, typed array, an object a leaf
 * returns, the public state of class instances) and the context. A change the instance makes after the start never
 * reaches the run, the run's own writes stay in the run, and two runs opened at different times each read the instance
 * as of their own start. `Map`, `Set`, `Date` and typed arrays read in a run are real objects of their kind (the run's
 * own copies), so native operations work on them; `structuredClone` works on what a run reads. Instances of a class
 * with `#private` fields keep their public members as of the start, and their methods run on the instance. Emitters are
 * shared live objects.
 *
 * @description
 * Every expected value is what plain JavaScript answers: the same read on a plain twin of the module's values made as
 * they were when the run started (for a read in the run), or as they are after the change (for a read on the instance).
 *
 * Fixture (written at run time): `data/data.mjs` exports the values and functions that change them through the
 * module's own variables; `probe/probe.mjs` evaluates an expression with its `self` and the runtime `context`.
 */
import path from "node:path";
import { EventEmitter } from "node:events";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { snapshotCounts } from "#helpers/run-snapshot";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot");
const BASE = path.join(ROOT, "api");
const TWIN = path.join(ROOT, "twin.mjs");

/**
 * The module's values, made fresh on each call: the module's own and a plain-JS twin for the expected answers. Kept in
 * one source so the twin is the module's values exactly.
 * @type {string}
 */
const VALUES_SOURCE = `
export class Box {
	constructor() {
		this.size = 1;
	}
	grow() {
		this.size++;
		return this.size;
	}
}
export class Counter {
	#hits = 0;
	count = 0;
	inc() {
		this.#hits++;
		return ++this.count;
	}
	hits() {
		return this.#hits;
	}
}
export function makeValues() {
	const held = { x: 1, deep: { y: 1 } };
	return {
		n: 1,
		cfg: { n: 1, nested: { a: 1 }, list: [1, 2] },
		map: new Map([["k", 1], ["o", { v: 1 }]]),
		set: new Set([1]),
		date: new Date(1000),
		bytes: new Uint8Array([1, 2, 3]),
		box: new Box(),
		counter: new Counter(),
		held,
		getObj() {
			return held;
		}
	};
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "data"), { recursive: true });
	mkdirSync(path.join(BASE, "probe"), { recursive: true });
	writeFileSync(TWIN, VALUES_SOURCE);
	writeFileSync(
		path.join(BASE, "data", "data.mjs"),
		[
			'import { EventEmitter } from "node:events";',
			'import { makeValues } from "../../twin.mjs";',
			"const values = makeValues();",
			"export let n = values.n;",
			"export const cfg = values.cfg;",
			"export const map = values.map;",
			"export const set = values.set;",
			"export const date = values.date;",
			"export const bytes = values.bytes;",
			"export const box = values.box;",
			"export const counter = values.counter;",
			"export const bus = new EventEmitter();",
			"export const target = new EventTarget();",
			"export function getObj() {",
			"\treturn values.getObj();",
			"}",
			"export function bumpOwn() {",
			"\tcfg.n++;",
			"\tcfg.nested.a++;",
			"\treturn cfg.n;",
			"}",
			"export function raw() {",
			"\treturn { cfgN: cfg.n, mapK: map.get('k'), setHas2: set.has(2), date: date.getTime(), b0: bytes[0], boxSize: box.size, count: counter.count, heldX: values.held.x, busFlag: bus.flag };",
			"}"
		].join("\n") + "\n"
	);
	// Every expression the tests evaluate is compiled into the probe's own source, so its reads are the probe module's
	// (code compiled at run time is no module's, and the permission system refuses it).
	const table = probeExpressions().map((src) => `\t[${JSON.stringify(src)}, (self, context) => (${src})]`);
	writeFileSync(
		path.join(BASE, "probe", "probe.mjs"),
		[
			'import { self, context } from "@cldmv/slothlet/runtime";',
			"const EXPRESSIONS = new Map([",
			table.join(",\n"),
			"]);",
			"export function evalIn(src) {",
			"\tconst read = EXPRESSIONS.get(src);",
			"\tif (read === undefined) throw new Error(`unknown expression: ${src}`);",
			"\treturn read(self, context);",
			"}"
		].join("\n") + "\n"
	);
});

/**
 * The expressions this file evaluates through the probe: its own double-quoted string literals that compile as one.
 * @returns {string[]} The expressions.
 */
function probeExpressions() {
	const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
	const found = new Set();
	for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
		let src;
		try {
			src = JSON.parse(match[0]);
		} catch {
			continue;
		}
		if (!/\b(self|context)\b/.test(src) && src !== "1") continue;
		if (/\$\{|`/.test(src)) continue;
		try {
			new Function("self", "context", `return (${src});`);
		} catch {
			continue;
		}
		found.add(src);
	}
	return [...found];
}

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/** The module's values as plain JS (see {@link VALUES_SOURCE}). */
let makeValues;
beforeAll(async () => {
	({ makeValues } = await import(TWIN));
});

/**
 * A plain twin of the module's values, with `changes` applied: what a read answers as plain JS.
 * @param {Array<function(object): void>} changes - Changes to apply, in order.
 * @returns {object} The twin, as `self` would hold it.
 */
function twin(changes = []) {
	const data = makeValues();
	data.bus = new EventEmitter();
	data.target = new EventTarget();
	const holder = { data };
	for (const change of changes) change(holder);
	return holder;
}

/**
 * Evaluate `src` with `self` set to `holder`, as the probe module does.
 * @param {object} holder - What `self` is.
 * @param {string} src - The expression.
 * @param {object} [context] - What `context` is.
 * @returns {*} Its value.
 */
function plainEval(holder, src, context = {}) {
	return new Function("self", "context", `return (${src});`)(holder, context);
}

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of ["off", "on"]) CONFIGS.push({ mode, runtime, permissions });

/**
 * Open a run that evaluates expressions in module code (through the probe's `self`) on request, until closed.
 * @param {object} api - The api.
 * @param {object} [context] - The run's own context.
 * @returns {{read: function(string): Promise<*>, close: function(): Promise<void>}} The run's handle.
 */
function openRun(api, context = {}) {
	const queue = [];
	let wake = null;
	const next = () =>
		queue.length
			? Promise.resolve(queue.shift())
			: new Promise((resolve) => {
					wake = resolve;
				});
	const done = api.slothlet.context.run(context, async () => {
		for (;;) {
			const job = await next();
			if (job === null) return;
			try {
				job.resolve({ value: job.fn ? await job.fn() : await api.probe.evalIn(job.src) });
			} catch (error) {
				job.resolve({ threw: error?.code ?? error?.name ?? String(error) });
			}
		}
	});
	const push = (job) => {
		if (wake !== null) {
			const resolve = wake;
			wake = null;
			resolve(job);
		} else queue.push(job);
	};
	return {
		read: (src) =>
			new Promise((resolve) => push({ src, resolve })).then((outcome) => {
				if ("threw" in outcome) throw new Error(`run read threw ${outcome.threw}: ${src}`);
				return outcome.value;
			}),
		attempt: (src) => new Promise((resolve) => push({ src, resolve })),
		host: (fn) =>
			new Promise((resolve) => push({ fn, resolve })).then((outcome) => {
				if ("threw" in outcome) throw new Error(`host code in the run threw ${outcome.threw}`);
				return outcome.value;
			}),
		close: async () => {
			push(null);
			await done;
		}
	};
}

/**
 * Instance-side changes made after a run started: the change through the instance, the same change on a twin, and the
 * reads to compare (in the run: as the twin was at the start; on the instance: as the twin is after).
 * @type {Array<[string, function(object): (void|Promise<void>), function(object): void, string[]]>}
 */
const INSTANCE_CHANGES = [
	["a top-level member through api", (api) => void (api.data.n = 2), (t) => void (t.data.n = 2), ["self.data.n"]],
	["a member through api", (api) => void (api.data.cfg.n = 50), (t) => void (t.data.cfg.n = 50), ["self.data.cfg.n"]],
	[
		"a nested member through api",
		(api) => void (api.data.cfg.nested.a = 50),
		(t) => void (t.data.cfg.nested.a = 50),
		["self.data.cfg.nested.a"]
	],
	[
		"a definition through api",
		(api) => void Object.defineProperty(api.data.cfg, "d", { value: 1, writable: true, enumerable: true, configurable: true }),
		(t) => void Object.defineProperty(t.data.cfg, "d", { value: 1, writable: true, enumerable: true, configurable: true }),
		["'d' in self.data.cfg", "self.data.cfg.d", "Object.keys(self.data.cfg).join()"]
	],
	[
		"a deletion through api",
		(api) => void delete api.data.cfg.nested.a,
		(t) => void delete t.data.cfg.nested.a,
		["'a' in self.data.cfg.nested", "self.data.cfg.nested.a"]
	],
	[
		"an object replaced through api",
		(api) => void (api.data.cfg.nested = { a: 9, b: 9 }),
		(t) => void (t.data.cfg.nested = { a: 9, b: 9 }),
		["self.data.cfg.nested.a", "'b' in self.data.cfg.nested"]
	],
	[
		"an array push through api",
		(api) => void api.data.cfg.list.push(3),
		(t) => void t.data.cfg.list.push(3),
		["self.data.cfg.list.join()"]
	],
	[
		"a member a module writes through self outside any run",
		(api) => api.probe.evalIn("self.data.cfg.n = 51"),
		(t) => void (t.data.cfg.n = 51),
		["self.data.cfg.n"]
	],
	[
		"an export a module changes through its own variable, from a call outside any run",
		(api) => api.data.bumpOwn(),
		(t) => void (t.data.cfg.n++, t.data.cfg.nested.a++),
		["self.data.cfg.n", "self.data.cfg.nested.a"]
	],
	["Map.set through api", (api) => void api.data.map.set("k", 50), (t) => void t.data.map.set("k", 50), ["self.data.map.get('k')"]],
	[
		"an object a Map holds, changed through api",
		(api) => void (api.data.map.get("o").v = 50),
		(t) => void (t.data.map.get("o").v = 50),
		["self.data.map.get('o').v"]
	],
	["Set.add through api", (api) => void api.data.set.add(2), (t) => void t.data.set.add(2), ["self.data.set.has(2)", "self.data.set.size"]],
	["Date.setTime through api", (api) => void api.data.date.setTime(50), (t) => void t.data.date.setTime(50), ["self.data.date.getTime()"]],
	["a typed array index through api", (api) => void (api.data.bytes[0] = 50), (t) => void (t.data.bytes[0] = 50), ["self.data.bytes[0]"]],
	["a class method changing this through api", (api) => void api.data.box.grow(), (t) => void t.data.box.grow(), ["self.data.box.size"]],
	[
		"a #private class's method through api",
		(api) => void api.data.counter.inc(),
		(t) => void t.data.counter.inc(),
		["self.data.counter.count"]
	],
	[
		"an object a leaf returned, changed by the host",
		async (api) => void ((await api.data.getObj()).x = 50),
		(t) => void (t.data.getObj().x = 50),
		["self.data.getObj().x"]
	]
];

describe.each(CONFIGS)(
	"a run reads the instance as of its start — $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the fixture.
		 * @param {{warm?: boolean, context?: object}} [options] - Whether to load the data module first, the context.
		 * @returns {Promise<object>} The api.
		 */
		async function load({ warm = true, context } = {}) {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				...(context ? { context } : {}),
				...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
			});
			if (warm) await api.data.raw();
			return api;
		}

		it.each(INSTANCE_CHANGES)("%s after the start does not reach the run", async (_name, change, twinChange, reads) => {
			await load();
			const run = openRun(api);
			const startTwin = twin();
			const afterTwin = twin([twinChange]);
			const before = [];
			for (const src of reads) before.push(await run.read(src));
			await change(api);
			const inRun = [];
			for (const src of reads) inRun.push(await run.read(src));
			await run.close();
			const outside = [];
			for (const src of reads) outside.push(await api.probe.evalIn(src));
			expect(before).toEqual(reads.map((src) => plainEval(startTwin, src)));
			expect(inRun).toEqual(reads.map((src) => plainEval(startTwin, src)));
			expect(outside).toEqual(reads.map((src) => plainEval(afterTwin, src)));
		});

		it.each(INSTANCE_CHANGES)(
			"%s after the start does not reach a run that first reads it after the change",
			async (_name, change, twinChange, reads) => {
				await load();
				const run = openRun(api);
				await run.read("1");
				await change(api);
				const inRun = [];
				for (const src of reads) inRun.push(await run.read(src));
				await run.close();
				const startTwin = twin();
				expect(inRun).toEqual(reads.map((src) => plainEval(startTwin, src)));
				void twinChange;
			}
		);

		it("two runs opened at different times each read the instance as of their own start", async () => {
			await load();
			const first = openRun(api);
			await first.read("1");
			api.data.cfg.n = 5;
			api.data.map.set("k", 5);
			const second = openRun(api);
			await second.read("1");
			api.data.cfg.n = 9;
			api.data.map.set("k", 9);
			const third = openRun(api);
			await third.read("1");
			expect([await first.read("self.data.cfg.n"), await first.read("self.data.map.get('k')")]).toEqual([1, 1]);
			expect([await second.read("self.data.cfg.n"), await second.read("self.data.map.get('k')")]).toEqual([5, 5]);
			expect([await third.read("self.data.cfg.n"), await third.read("self.data.map.get('k')")]).toEqual([9, 9]);
			await Promise.all([first.close(), second.close(), third.close()]);
			expect(api.data.cfg.n).toBe(9);
		});

		it("a run's own writes stay in the run, including writes to a Map, Set, Date and typed array", async () => {
			await load();
			const run = openRun(api);
			const writes = [
				"(self.data.cfg.n = 7, self.data.cfg.n)",
				"(self.data.map.set('k', 7), self.data.map.get('k'))",
				"(self.data.map.get('o').v = 7, self.data.map.get('o').v)",
				"(self.data.set.add(7), self.data.set.has(7))",
				"(self.data.date.setTime(7), self.data.date.getTime())",
				"(self.data.bytes[0] = 7, self.data.bytes[0])",
				"(self.data.getObj().x = 7, self.data.getObj().x)",
				"(self.data.box.size = 7, self.data.box.size)"
			];
			const plainTwin = twin();
			const seen = [];
			for (const src of writes) seen.push(await run.read(src));
			await run.close();
			expect(seen).toEqual(writes.map((src) => plainEval(plainTwin, src)));
			const fresh = twin();
			expect(await api.data.raw()).toEqual({
				cfgN: fresh.data.cfg.n,
				mapK: fresh.data.map.get("k"),
				setHas2: false,
				date: fresh.data.date.getTime(),
				b0: fresh.data.bytes[0],
				boxSize: fresh.data.box.size,
				count: 0,
				heldX: fresh.data.held.x,
				busFlag: undefined
			});
			expect(api.data.map.get("o").v).toBe(1);
			expect(api.data.set.has(7)).toBe(false);
		});

		it("Map, Set, Date and typed arrays read in a run are real objects of their kind", async () => {
			await load();
			const run = openRun(api);
			const reads = [
				"self.data.map instanceof Map",
				"Map.prototype.get.call(self.data.map, 'k')",
				"self.data.map === self.data.map",
				"structuredClone(self.data.map).get('k')",
				"[...self.data.map.keys()].join()",
				"Set.prototype.has.call(self.data.set, 1)",
				"Date.prototype.getTime.call(self.data.date)",
				"structuredClone(self.data.date).getTime()",
				"self.data.bytes instanceof Uint8Array",
				"Array.from(structuredClone(self.data.bytes)).join()",
				"self.data.bytes.length"
			];
			const plainTwin = twin();
			const seen = [];
			for (const src of reads) seen.push(await run.read(src));
			await run.close();
			expect(seen).toEqual(reads.map((src) => plainEval(plainTwin, src)));
		});

		it("structuredClone works on a plain object and array a run reads", async () => {
			await load();
			const run = openRun(api);
			const reads = [
				"JSON.stringify(structuredClone(self.data.cfg))",
				"structuredClone(self.data.cfg.list).join()",
				"JSON.stringify(self.data.cfg)"
			];
			const seen = [];
			for (const src of reads) seen.push(await run.read(src));
			await run.close();
			const plainTwin = twin();
			expect(seen).toEqual(reads.map((src) => plainEval(plainTwin, src)));
		});

		it("a #private class's methods work in a run and run on the instance; its public members read as of the start", async () => {
			await load();
			const run = openRun(api);
			expect(await run.attempt("self.data.counter.inc()")).toEqual({ value: 1 });
			expect(await run.read("self.data.counter.hits()")).toBe(1);
			// The method ran on the instance itself: what it changed through `this` is the instance's.
			expect(api.data.counter.count).toBe(1);
			await run.close();
			expect(await api.data.counter.hits()).toBe(1);
		});

		it("emitters are shared live objects: listeners work both ways and a member a run sets reaches the instance", async () => {
			await load();
			const heardInRun = [];
			const heardOnHost = [];
			api.data.bus.on("host", (value) => heardOnHost.push(value));
			const run = openRun(api);
			globalThis.__runSnapshotHeard = heardInRun;
			await run.read("(self.data.bus.on('run', (value) => globalThis.__runSnapshotHeard.push(value)), 1)");
			api.data.bus.emit("run", "from-host");
			await run.read("self.data.bus.emit('host', 'from-run')");
			await run.read("(self.data.bus.flag = 1, self.data.bus.flag)");
			const target = await run.read("(self.data.target.addEventListener('t', () => globalThis.__runSnapshotHeard.push('target')), 1)");
			api.data.target.dispatchEvent(new Event("t"));
			await run.close();
			delete globalThis.__runSnapshotHeard;
			expect(target).toBe(1);
			expect(heardInRun).toEqual(["from-host", "target"]);
			expect(heardOnHost).toEqual(["from-run"]);
			expect(api.data.bus.flag).toBe(1);
		});

		it("a run keeps the context it started with: context.set() after the start does not reach it", async () => {
			await load({ context: { tenant: "acme", region: "eu" } });
			const run = openRun(api, { tenant: "request" });
			expect(await run.read("[context.tenant, context.region]")).toEqual(["request", "eu"]);
			api.slothlet.context.set({ tenant: "globex", region: "us", extra: 1 });
			expect(await run.read("[context.tenant, context.region, context.extra]")).toEqual(["request", "eu", undefined]);
			await run.close();
			expect(await api.probe.evalIn("[context.tenant, context.region, context.extra]")).toEqual(["globex", "us", 1]);
		});

		it("a node first loaded during the run reads as of the start", async () => {
			await load({ warm: false });
			const run = openRun(api);
			await run.read("1");
			api.data.cfg.n = 5;
			api.data.map.set("k", 5);
			expect([await run.read("self.data.cfg.n"), await run.read("self.data.map.get('k')")]).toEqual([1, 1]);
			await run.close();
			expect([api.data.cfg.n, api.data.map.get("k")]).toEqual([5, 5]);
		});

		it("a nested run reads its parent as of the nested run's start", async () => {
			await load();
			const seen = await api.slothlet.context.run({}, async () => {
				await api.probe.evalIn("(self.data.cfg.n = 7, self.data.map.set('k', 7))");
				let release;
				const go = new Promise((resolve) => (release = resolve));
				let entered;
				const inside = new Promise((resolve) => (entered = resolve));
				const inner = api.slothlet.context.run({}, async () => {
					const first = await api.probe.evalIn("[self.data.cfg.n, self.data.map.get('k')]");
					entered();
					await go;
					return [first, await api.probe.evalIn("[self.data.cfg.n, self.data.map.get('k')]")];
				});
				await inside;
				await api.probe.evalIn("(self.data.cfg.n = 8, self.data.map.set('k', 8))");
				api.data.cfg.n = 9;
				release();
				return [await inner, await api.probe.evalIn("[self.data.cfg.n, self.data.map.get('k')]")];
			});
			expect(seen).toEqual([
				[
					[7, 7],
					[7, 7]
				],
				[8, 8]
			]);
			expect([api.data.cfg.n, api.data.map.get("k")]).toEqual([9, 1]);
		});

		it("concurrent runs keep their writes apart and each reads its start", async () => {
			await load();
			const a = openRun(api);
			const b = openRun(api);
			await a.read("(self.data.cfg.n = 2, self.data.map.set('k', 2))");
			await b.read("(self.data.cfg.n = 3, self.data.map.set('k', 3))");
			api.data.cfg.n = 4;
			expect(await a.read("[self.data.cfg.n, self.data.map.get('k')]")).toEqual([2, 2]);
			expect(await b.read("[self.data.cfg.n, self.data.map.get('k')]")).toEqual([3, 3]);
			await Promise.all([a.close(), b.close()]);
			expect([api.data.cfg.n, api.data.map.get("k")]).toEqual([4, 1]);
		});

		it("a reload during the run leaves the run on what it started with", async () => {
			await load();
			const run = openRun(api);
			expect(await run.read("self.data.cfg.n")).toBe(1);
			api.data.cfg.n = 5;
			await api.slothlet.reload();
			await api.data.raw();
			api.data.cfg.n = 6;
			expect(await run.read("self.data.cfg.n")).toBe(1);
			await run.close();
			expect(api.data.cfg.n).toBe(6);
		});

		it("permission rules still decide a read the snapshot answers, and a rule the run adds holds for it", async () => {
			if (permissions !== "on") return;
			await load();
			const run = openRun(api);
			expect(await run.read("self.data.cfg.n")).toBe(1);
			api.data.cfg.n = 5;
			await run.host(() => api.slothlet.permissions.rules.add({ caller: "probe.**", target: "data.cfg.**", effect: "deny" }));
			const denied = await run.attempt("self.data.cfg.n");
			expect(denied).toHaveProperty("threw");
			await run.close();
			expect(await api.probe.evalIn("self.data.cfg.n")).toBe(5);
		});

		it("a run that never ends does not make the versions the instance keeps grow without bound", async () => {
			await load();
			const long = openRun(api);
			expect(await long.read("self.data.cfg.n")).toBe(1);
			const baseline = snapshotCounts().versions;
			for (let index = 0; index < 200; index++) {
				const short = openRun(api);
				await short.read("self.data.cfg.n");
				api.data.cfg.n = index + 2;
				api.data.map.set("k", index + 2);
				await short.close();
				if (index % 50 === 0) await new Promise((resolve) => setImmediate(resolve));
			}
			await new Promise((resolve) => setImmediate(resolve));
			expect(snapshotCounts().versions - baseline).toBeLessThan(20);
			expect([await long.read("self.data.cfg.n"), await long.read("self.data.map.get('k')")]).toEqual([1, 1]);
			await long.close();
			expect(api.data.cfg.n).toBe(201);
		});
	}
);
