/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-reach.test.vitest.mjs
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
 * @fileoverview The edges of a run's snapshot: a write made through a stand-in for a node not loaded yet, a change at
 * the api's root, a prototype or extensibility change, a value a leaf hands back through a promise, an outer run's
 * changes to its own copies after a nested run opened, and an object the instance replaced after the run read it. Each
 * is made after the run started, and the run reads the instance as of its start.
 *
 * @description
 * Every expected value is what plain JavaScript answers: the same read on a plain twin of the module's values made as
 * they were when the run started (for a read in the run), or as they are after the change (for a read on the instance).
 *
 * Fixture (written at run time): `data/data.mjs` exports the values; `probe/probe.mjs` evaluates an expression with its
 * `self`.
 */
import path from "node:path";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-reach");
const BASE = path.join(ROOT, "api");
const TWIN = path.join(ROOT, "twin.mjs");

/**
 * The module's values, made fresh on each call: the module's own and a plain-JS twin for the expected answers.
 * @type {string}
 */
const VALUES_SOURCE = `
export function makeValues() {
	const held = { x: 1, deep: { y: 1 } };
	return {
		cfg: { n: 1, list: [1, 2] },
		map: new Map([["k", 1], ["o", { v: 1 }]]),
		set: new Set([1]),
		date: new Date(1000),
		held,
		getObj() {
			return held;
		},
		async getObjAsync() {
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
			'import { makeValues } from "../../twin.mjs";',
			"const values = makeValues();",
			"export const cfg = values.cfg;",
			"export const map = values.map;",
			"export const set = values.set;",
			"export const date = values.date;",
			"export function getObj() {",
			"\treturn values.getObj();",
			"}",
			"export async function getObjAsync() {",
			"\treturn values.getObjAsync();",
			"}",
			"export function heldX() {",
			"\treturn values.held.x;",
			"}"
		].join("\n") + "\n"
	);
	const table = probeExpressions().map((src) => `\t[${JSON.stringify(src)}, (self) => (${src})]`);
	writeFileSync(
		path.join(BASE, "probe", "probe.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"const EXPRESSIONS = new Map([",
			table.join(",\n"),
			"]);",
			"export function evalIn(src) {",
			"\tconst read = EXPRESSIONS.get(src);",
			"\tif (read === undefined) throw new Error(`unknown expression: ${src}`);",
			"\treturn read(self);",
			"}"
		].join("\n") + "\n"
	);
});

/**
 * The expressions this file evaluates through the probe: its own double-quoted string literals that name `self` and
 * compile as one.
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
		if (!/\bself\b/.test(src) && src !== "1") continue;
		if (/\$\{|`/.test(src)) continue;
		try {
			new Function("self", `return (${src});`);
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
 * A plain twin of what `self` holds, with `changes` applied.
 * @param {Array<function(object): void>} changes - Changes to apply, in order.
 * @returns {object} The twin, as `self` would hold it.
 */
function twin(changes = []) {
	const holder = { data: makeValues(), extra: { v: 1 } };
	for (const change of changes) change(holder);
	return holder;
}

/**
 * Evaluate `src` with `self` set to `holder`, as the probe module does.
 * @param {object} holder - What `self` is.
 * @param {string} src - The expression.
 * @returns {*} Its value.
 */
function plainEval(holder, src) {
	return new Function("self", `return (${src});`)(holder);
}

/**
 * Evaluate each expression on a twin, awaiting each in turn.
 * @param {object} holder - What `self` is.
 * @param {string[]} reads - The expressions.
 * @returns {Promise<Array<*>>} Their values.
 */
async function plainReads(holder, reads) {
	const out = [];
	for (const src of reads) out.push(await plainEval(holder, src));
	return out;
}

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of ["off", "on"]) CONFIGS.push({ mode, runtime, permissions });

/**
 * Open a run that evaluates expressions in module code (through the probe's `self`) on request, until closed.
 * @param {object} api - The api.
 * @returns {{read: function(string): Promise<*>, host: function(function(): *): Promise<*>, reads: function(string[]): Promise<Array<*>>, close: function(): Promise<void>}} The run's handle.
 */
function openRun(api) {
	const queue = [];
	let wake = null;
	const next = () =>
		queue.length
			? Promise.resolve(queue.shift())
			: new Promise((resolve) => {
					wake = resolve;
				});
	const done = api.slothlet.context.run({}, async () => {
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
	const read = (src) =>
		new Promise((resolve) => push({ src, resolve })).then((outcome) => {
			if ("threw" in outcome) throw new Error(`run read threw ${outcome.threw}: ${src}`);
			return outcome.value;
		});
	return {
		read,
		host: (fn) =>
			new Promise((resolve) => push({ fn, resolve })).then((outcome) => {
				if ("threw" in outcome) throw new Error(`host code in the run threw ${outcome.threw}`);
				return outcome.value;
			}),
		reads: async (list) => {
			const out = [];
			for (const src of list) out.push(await read(src));
			return out;
		},
		close: async () => {
			push(null);
			await done;
		}
	};
}

describe.each(CONFIGS)("a run's snapshot at its edges — $mode / $runtime / permissions $permissions", ({ mode, runtime, permissions }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the fixture, with `extra` set at the api's root.
	 * @param {{warm?: boolean}} [options] - Whether to load the data module first.
	 * @returns {Promise<object>} The api.
	 */
	async function load({ warm = true } = {}) {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
		});
		api.extra = { v: 1 };
		if (warm) await api.data.heldX();
		return api;
	}

	it("a write made through a stand-in for a node not loaded yet, after the start, does not reach the run", async () => {
		await load({ warm: false });
		const run = openRun(api);
		await run.read("1");
		await api.data.map.set("k", 5);
		await api.data.set.add(5);
		await api.data.date.setTime(5);
		api.data.cfg.n = 5;
		const reads = ["self.data.map.get('k')", "self.data.set.has(5)", "self.data.date.getTime()", "self.data.cfg.n"];
		const inRun = await run.reads(reads);
		await run.close();
		expect(inRun).toEqual(await plainReads(twin(), reads));
		expect([api.data.map.get("k"), api.data.set.has(5), api.data.date.getTime(), api.data.cfg.n]).toEqual([5, true, 5, 5]);
	});

	it("a member of the api's root replaced, added or deleted after the start does not reach the run", async () => {
		await load();
		const run = openRun(api);
		const reads = ["self.extra.v", "'added' in self", "self.added", "'extra' in self"];
		const before = await run.reads(reads);
		api.extra = { v: 2 };
		api.added = 1;
		const replaced = await run.reads(reads);
		delete api.extra;
		const deleted = await run.reads(reads);
		await run.close();
		const start = await plainReads(twin(), reads);
		expect(before).toEqual(start);
		expect(replaced).toEqual(start);
		expect(deleted).toEqual(start);
		expect([api.added, "extra" in api]).toEqual([1, false]);
	});

	it("a member of the api's root replaced after the start does not reach a run that first reads it after", async () => {
		await load();
		const run = openRun(api);
		await run.read("1");
		api.extra = { v: 2 };
		api.added = 1;
		const reads = ["self.extra.v", "'added' in self"];
		const inRun = await run.reads(reads);
		await run.close();
		expect(inRun).toEqual(await plainReads(twin(), reads));
	});

	it("a prototype the instance sets on a node after the start does not reach the run", async () => {
		await load();
		const run = openRun(api);
		const reads = ["self.data.cfg.inherited", "Object.getPrototypeOf(self.data.cfg) === Object.prototype", "'inherited' in self.data.cfg"];
		const before = await run.reads(reads);
		Object.setPrototypeOf(api.data.cfg, { inherited: 1 });
		const inRun = await run.reads(reads);
		await run.close();
		const start = await plainReads(twin(), reads);
		expect(before).toEqual(start);
		expect(inRun).toEqual(start);
		expect(api.data.cfg.inherited).toBe(1);
	});

	it("a node the instance closes after the start stays open in the run", async () => {
		await load();
		const run = openRun(api);
		await run.read("self.data.cfg.n");
		Object.freeze(api.data.cfg);
		const reads = [
			"Object.isFrozen(self.data.cfg)",
			"Object.isExtensible(self.data.cfg)",
			"(self.data.cfg.n = 3, self.data.cfg.n)",
			"(self.data.cfg.z = 4, self.data.cfg.z)"
		];
		const inRun = await run.reads(reads);
		await run.close();
		expect(inRun).toEqual(await plainReads(twin(), reads));
		expect([Object.isFrozen(api.data.cfg), api.data.cfg.n, "z" in api.data.cfg]).toEqual([true, 1, false]);
	});

	it("a value a leaf hands back through a promise reads as of the start, and the run's writes to it stay in the run", async () => {
		await load();
		const run = openRun(api);
		const reads = [
			"self.data.getObjAsync().then((o) => o.x)",
			"self.data.getObjAsync().then((o) => o.deep.y)",
			"self.data.getObjAsync().then((o) => o === self.data.getObj())"
		];
		const before = await run.reads(reads);
		const got = await api.data.getObjAsync();
		got.x = 50;
		got.deep.y = 50;
		const inRun = await run.reads(reads);
		const wrote = await run.read("self.data.getObjAsync().then((o) => ((o.x = 7), o.x))");
		const readBack = await run.read("self.data.getObj().x");
		await run.close();
		const start = await plainReads(twin(), reads);
		expect(before).toEqual(start);
		expect(inRun).toEqual(start);
		expect([wrote, readBack]).toEqual([7, 7]);
		expect(await api.data.heldX()).toBe(50);
	});

	it("a value a leaf hands back through a promise is saved before the host has it, for a run that has not read it yet", async () => {
		await load();
		const run = openRun(api);
		await run.read("1");
		const got = await api.data.getObjAsync();
		got.x = 50;
		const inRun = await run.read("self.data.getObj().x");
		await run.close();
		expect(inRun).toBe(1);
	});

	it("a nested run does not see what its outer run changes in its own copies after the nested run opened", async () => {
		await load();
		const reads = [
			"self.data.map.get('k')",
			"self.data.date.getTime()",
			"self.data.set.has(9)",
			"self.data.cfg.list.join()",
			"self.data.cfg.inh",
			"self.data.getObj().x"
		];
		const seen = await api.slothlet.context.run({}, async () => {
			await api.probe.evalIn("self.data.map.get('k')");
			await api.probe.evalIn("self.data.date.getTime()");
			await api.probe.evalIn("self.data.set.has(9)");
			await api.probe.evalIn("self.data.cfg.list.push(3)");
			await api.probe.evalIn("Object.setPrototypeOf(self.data.cfg, { inh: 1 })");
			await api.probe.evalIn("(self.data.getObj().x = 7)");
			let release;
			const go = new Promise((resolve) => (release = resolve));
			let entered;
			const inside = new Promise((resolve) => (entered = resolve));
			const inner = api.slothlet.context.run({}, async () => {
				entered();
				await go;
				const out = [];
				for (const src of reads) out.push(await api.probe.evalIn(src));
				return out;
			});
			await inside;
			await api.probe.evalIn("self.data.map.set('k', 8)");
			await api.probe.evalIn("self.data.date.setTime(8)");
			await api.probe.evalIn("self.data.set.add(9)");
			await api.probe.evalIn("self.data.cfg.list.push(9)");
			await api.probe.evalIn("Object.setPrototypeOf(self.data.cfg, { inh: 2 })");
			await api.probe.evalIn("(self.data.getObj().x = 8)");
			release();
			const outer = [];
			for (const src of reads) outer.push(await api.probe.evalIn(src));
			return [await inner, outer];
		});
		const atNestedStart = twin([
			(t) => {
				t.data.cfg.list.push(3);
				Object.setPrototypeOf(t.data.cfg, { inh: 1 });
				t.data.getObj().x = 7;
			}
		]);
		const atEnd = twin([
			(t) => {
				t.data.map.set("k", 8);
				t.data.date.setTime(8);
				t.data.set.add(9);
				t.data.cfg.list.push(3, 9);
				Object.setPrototypeOf(t.data.cfg, { inh: 2 });
				t.data.getObj().x = 8;
			}
		]);
		expect(seen[0]).toEqual(await plainReads(atNestedStart, reads));
		expect(seen[1]).toEqual(await plainReads(atEnd, reads));
		expect([api.data.map.get("k"), api.data.cfg.list.join(), await api.data.heldX()]).toEqual([1, "1,2", 1]);
	});

	it("host code inside the run changing values through api does not reach the run's self", async () => {
		await load();
		const run = openRun(api);
		const reads = ["self.data.getObj().x", "self.data.map.get('k')", "self.data.getObjAsync().then((o) => o.deep.y)"];
		await run.read("1");
		await run.host(async () => {
			(await api.data.getObj()).x = 50;
			api.data.map.set("k", 50);
			(await api.data.getObjAsync()).deep.y = 50;
		});
		const inRun = await run.reads(reads);
		await run.close();
		expect(inRun).toEqual(await plainReads(twin(), reads));
		expect([await api.data.heldX(), api.data.map.get("k")]).toEqual([50, 50]);
	});

	it("an object the instance replaced after the run read it reads as of the start", async () => {
		await load();
		const run = openRun(api);
		const reads = ["self.data.getObj().deep.y", "self.data.map.get('o').v", "self.data.getObj().deep === self.data.getObj().deep"];
		const before = await run.reads(reads);
		const held = await api.data.getObj();
		const oldDeep = held.deep;
		held.deep = { y: 9 };
		oldDeep.y = 7;
		const oldO = api.data.map.get("o");
		api.data.map.set("o", { v: 9 });
		oldO.v = 7;
		const inRun = await run.reads(reads);
		await run.close();
		const start = await plainReads(twin(), reads);
		expect(before).toEqual(start);
		expect(inRun).toEqual(start);
		expect([(await api.data.getObj()).deep.y, api.data.map.get("o").v]).toEqual([9, 9]);
	});
});
