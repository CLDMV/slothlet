/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-protos.test.vitest.mjs
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
 * @fileoverview A run's snapshot of prototypes, closed nodes and getters: a module's own prototype object (an
 * `Object.create()` parent, a class's prototype) changed or replaced by the instance after the run started, a prototype
 * given to the api's root after the start, a node the instance closed after the start (which the run can still give a
 * prototype or close itself), and a getter read through a stand-in for a node not loaded yet, which runs once per read.
 *
 * @description
 * Every expected value is what plain JavaScript answers: the same read on a plain twin of the module's values made as
 * they were when the run started, with what the run did itself applied in order.
 *
 * Fixture (written at run time): `api/data/data.mjs` exports the values, `api/counter/counter.mjs` a getter that counts
 * its reads, `api/probe/probe.mjs` evaluates an expression with its `self`; `fnroot/` and `objroot/` are a function root
 * and an object root with the same probe.
 */
import path from "node:path";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-protos");
const BASE = path.join(ROOT, "api");
const TWIN = path.join(ROOT, "twin.mjs");

/**
 * The module's values, made fresh on each call: the module's own and a plain-JS twin for the expected answers.
 * @type {string}
 */
const VALUES_SOURCE = `
export function makeValues() {
	const protoObj = {
		greet: 1,
		hello() {
			return this.greet;
		}
	};
	const obj = Object.create(protoObj);
	obj.own = 1;
	class Counter {
		constructor() {
			this.n = 1;
		}
		label() {
			return "a";
		}
	}
	const inst = new Counter();
	let reads = 0;
	const counter = {
		get value() {
			reads++;
			return reads;
		},
		reads() {
			return reads;
		}
	};
	return { protoObj, obj, Counter, inst, cfg: { n: 1 }, counter };
}
`;

/**
 * The probe module's source: it evaluates the expressions this file names with its `self`.
 * @returns {string} The source.
 */
function probeSource() {
	const table = probeExpressions().map((src) => `\t[${JSON.stringify(src)}, (self) => (${src})]`);
	return (
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
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["data", "counter", "probe"]) mkdirSync(path.join(BASE, dir), { recursive: true });
	writeFileSync(TWIN, VALUES_SOURCE);
	writeFileSync(
		path.join(BASE, "data", "data.mjs"),
		[
			'import { makeValues } from "../../twin.mjs";',
			"const values = makeValues();",
			"export const obj = values.obj;",
			"export const inst = values.inst;",
			"export const Counter = values.Counter;",
			"export const cfg = values.cfg;",
			"export function setProto(key, value) {",
			"\tvalues.protoObj[key] = value;",
			"}",
			"export function relabel(text) {",
			"\tvalues.Counter.prototype.label = function () {",
			"\t\treturn text;",
			"\t};",
			"}",
			"export function greetNow() {",
			"\treturn values.obj.greet;",
			"}"
		].join("\n") + "\n"
	);
	writeFileSync(
		path.join(BASE, "counter", "counter.mjs"),
		['import { makeValues } from "../../twin.mjs";', "export default makeValues().counter;"].join("\n") + "\n"
	);
	const probe = probeSource();
	writeFileSync(path.join(BASE, "probe", "probe.mjs"), probe);
	for (const root of ["fnroot", "objroot"]) {
		mkdirSync(path.join(ROOT, root, "probe"), { recursive: true });
		writeFileSync(path.join(ROOT, root, "probe", "probe.mjs"), probe);
		writeFileSync(path.join(ROOT, root, "data.mjs"), "export const a = 1;\n");
	}
	writeFileSync(path.join(ROOT, "fnroot", "root.mjs"), 'export default function root() {\n\treturn "root";\n}\n');
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
 * @returns {{read: function(string): Promise<*>, reads: function(string[]): Promise<Array<*>>, close: function(): Promise<void>}} The run's handle.
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
				job.resolve({ value: await api.probe.evalIn(job.src) });
			} catch (error) {
				job.resolve({ threw: `${error?.code ?? error?.name} ${error?.message}` });
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

/**
 * The slothlet options for a config.
 * @param {{mode: string, runtime: string, permissions: string}} config - The config.
 * @param {string} base - The base directory.
 * @returns {object} The options.
 */
function optionsFor({ mode, runtime, permissions }, base) {
	return {
		base,
		mode,
		runtime,
		silent: true,
		...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
	};
}

describe.each(CONFIGS)("a run's snapshot of prototypes and getters — $mode / $runtime / permissions $permissions", (config) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the fixture.
	 * @param {{warm?: boolean}} [options] - Whether to load the data module first.
	 * @returns {Promise<object>} The api.
	 */
	async function load({ warm = true } = {}) {
		api = await slothlet(optionsFor(config, BASE));
		if (warm) await api.data.greetNow();
		return api;
	}

	it("a module's own prototype object changed by the instance after the start reads as of the start", async () => {
		await load();
		const run = openRun(api);
		const reads = [
			"self.data.obj.greet",
			"self.data.obj.hello()",
			"'added' in self.data.obj",
			"self.data.obj.added",
			"'host' in self.data.obj",
			"Object.getPrototypeOf(self.data.obj).greet",
			"self.data.inst.label()",
			"self.data.inst.tag",
			"'tag' in self.data.inst"
		];
		const before = await run.reads(reads);
		await api.data.setProto("greet", 2);
		await api.data.setProto("added", 1);
		await api.data.relabel("b");
		Object.getPrototypeOf(api.data.obj).host = 1;
		api.data.Counter.prototype.tag = 2;
		const inRun = await run.reads(reads);
		await run.close();
		const start = await plainReads({ data: makeValues() }, reads);
		expect(before).toEqual(start);
		expect(inRun).toEqual(start);
		expect([await api.data.greetNow(), await api.data.inst.label(), api.data.inst.tag]).toEqual([2, "b", 2]);
	});

	it("a module's own prototype object changed after the start reads as of the start in a run that first reads it after", async () => {
		await load();
		const run = openRun(api);
		await run.read("1");
		await api.data.setProto("greet", 2);
		await api.data.relabel("b");
		const reads = ["self.data.obj.greet", "self.data.obj.hello()", "self.data.inst.label()"];
		const inRun = await run.reads(reads);
		await run.close();
		expect(inRun).toEqual(await plainReads({ data: makeValues() }, reads));
	});

	it("a member the instance gives a node after the start over one it inherits reads as inherited in the run", async () => {
		await load();
		const run = openRun(api);
		const reads = ["self.data.obj.greet", "Object.hasOwn(self.data.obj, 'greet')", "self.data.obj.hello()"];
		const before = await run.reads(reads);
		api.data.obj.greet = 7;
		const inRun = await run.reads(reads);
		await run.close();
		const start = await plainReads({ data: makeValues() }, reads);
		expect(before).toEqual(start);
		expect(inRun).toEqual(start);
		expect(api.data.obj.greet).toBe(7);
	});

	it("a module's own prototype a node held, replaced by the instance after the start, reads as of the start", async () => {
		await load();
		const run = openRun(api);
		const reads = [
			"self.data.obj.greet",
			"self.data.obj.hello()",
			"'hello' in self.data.obj",
			"Object.getPrototypeOf(self.data.obj).greet",
			"self.data.inst.label()",
			"self.data.inst instanceof self.data.Counter"
		];
		const before = await run.reads(reads);
		Object.setPrototypeOf(api.data.obj, { greet: 9 });
		Object.setPrototypeOf(api.data.inst, {
			label() {
				return "z";
			}
		});
		const inRun = await run.reads(reads);
		await run.close();
		const start = await plainReads({ data: makeValues() }, reads);
		expect(before).toEqual(start);
		expect(inRun).toEqual(start);
		expect([api.data.obj.greet, await api.data.inst.label()]).toEqual([9, "z"]);
	});

	it.each(["freeze", "seal", "preventExtensions"])(
		"a node the instance closes (%s) after the start can still be given a prototype and closed by the run, which keeps both",
		async (close) => {
			await load();
			const run = openRun(api);
			await run.read("self.data.cfg.n");
			Object[close](api.data.cfg);
			const reads = [
				"Reflect.setPrototypeOf(self.data.cfg, { inh: 1 })",
				"self.data.cfg.inh",
				"Object.getPrototypeOf(self.data.cfg).inh",
				"Reflect.set(self.data.cfg, 'n', 3)",
				"(Object.seal(self.data.cfg), [Object.isSealed(self.data.cfg), Object.isExtensible(self.data.cfg)])",
				"[Reflect.set(self.data.cfg, 'n', 4), Reflect.set(self.data.cfg, 'zz', 1), self.data.cfg.n, 'zz' in self.data.cfg]",
				"(Object.freeze(self.data.cfg), [Object.isFrozen(self.data.cfg), Reflect.set(self.data.cfg, 'n', 5), self.data.cfg.n])",
				"[Reflect.setPrototypeOf(self.data.cfg, null), self.data.cfg.inh]"
			];
			const inRun = await run.reads(reads);
			await run.close();
			expect(inRun).toEqual(await plainReads({ data: makeValues() }, reads));
			const closedNow = close === "freeze" ? Object.isFrozen : close === "seal" ? Object.isSealed : (o) => !Object.isExtensible(o);
			expect([closedNow(api.data.cfg), api.data.cfg.n, "inh" in api.data.cfg, Object.getPrototypeOf(api.data.cfg)]).toEqual([
				true,
				1,
				false,
				Object.prototype
			]);
		}
	);

	it("a getter read through a stand-in for a node not loaded yet runs once per read", async () => {
		await load({ warm: false });
		const run = openRun(api);
		const reads = ["self.counter.value", "self.counter.reads()", "self.counter.value", "self.counter.reads()"];
		const inRun = await run.reads(reads);
		await run.close();
		expect(inRun).toEqual(await plainReads({ counter: makeValues().counter }, reads));
	});

	describe.each([
		["a function root", "fnroot"],
		["an object root", "objroot"]
	])("%s", (_label, root) => {
		/**
		 * A plain twin of the root.
		 * @returns {object|Function} The twin.
		 */
		const plainRoot = () =>
			root === "fnroot"
				? function root() {
						return "root";
					}
				: {};

		it("a prototype the instance gives the root after the start does not reach the run", async () => {
			api = await slothlet(optionsFor(config, path.join(ROOT, root)));
			const run = openRun(api);
			const reads = [
				"self.inh",
				"'inh' in self",
				"Object.getPrototypeOf(self) === (typeof self === 'function' ? Function.prototype : Object.prototype)"
			];
			const before = await run.reads(reads);
			Object.setPrototypeOf(api, { inh: 1 });
			const inRun = await run.reads(reads);
			await run.close();
			const start = await plainReads(plainRoot(), reads);
			expect(before).toEqual(start);
			expect(inRun).toEqual(start);
			expect(api.inh).toBe(1);
		});

		it("a prototype the instance gives the root after the start, in place of one it gave before, does not reach the run", async () => {
			api = await slothlet(optionsFor(config, path.join(ROOT, root)));
			Object.setPrototypeOf(api, { inh: 1 });
			const run = openRun(api);
			// A module's `self` of an object root reports `Object.prototype` whatever the root was given, outside runs too.
			const reads = ["self.inh", "'inh' in self", ...(root === "fnroot" ? ["Object.getPrototypeOf(self).inh"] : [])];
			await run.read("1");
			Object.setPrototypeOf(api, { inh: 2 });
			const inRun = await run.reads(reads);
			await run.close();
			const twin = plainRoot();
			Object.setPrototypeOf(twin, { inh: 1 });
			expect(inRun).toEqual(await plainReads(twin, reads));
			expect(api.inh).toBe(2);
		});
	});
});
