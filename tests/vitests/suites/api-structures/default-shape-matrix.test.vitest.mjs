/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-structures/default-shape-matrix.test.vitest.mjs
 *	@Date: 2026-10-12T21:22:05-07:00 (1791865325)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T21:31:20-07:00 (1791865880)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's default answers through the api as it does in plain JavaScript, in every shape and
 * composition path, in eager and lazy mode alike (#585).
 *
 * @description
 * Each cell writes one api folder: the default of shape `S` at path `P`, with or without a named export, and
 * loads it once eager and once lazy. On the api node it runs the shape's steps (reads, writes, method calls, a
 * call of the node itself) and compares each result with the same steps run on a plain copy of the default,
 * so the expected values are what plain JavaScript answers, never the current output. It also checks:
 * - a primitive default is the node's value alone, and sits under `default` beside a named export or siblings;
 * - the named export and sibling files are callable and answer their own values;
 * - `Object.keys()` of the node is the same in both modes;
 * - the module's own export is never written to (no key is added to it).
 *
 * Shapes: a plain object (method, getter), a frozen object, a class instance (private field, accessor pair),
 * a `Map`, an array, a function with an own member, a callable Proxy, an object Proxy, a read-only Proxy, and
 * the primitives `3`, `0` and `null`. Paths: a root file, a file in a namespace, a folder's self-named file,
 * the same beside siblings, an `addapi` file beside a sibling, an `addapi` file mounted with `api.add`, and a
 * single-file folder. 12 shapes × 7 paths × with/without a named export = 168 cells.
 *
 * @module tests/vitests/suites/api-structures/default-shape-matrix
 */

import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import slothlet from "@cldmv/slothlet";

const ROOT = path.resolve("tmp", `slothlet-shape-matrix-${process.pid}-${Math.random().toString(36).slice(2)}`);

/** Shapes: `src` builds the default (a JS expression); `steps` run on the api node and on a plain copy. */
const SHAPES = {
	obj: {
		src: `{ own: 1, method() { return "m:" + this.own; }, get g() { return this.own * 2; } }`,
		steps: [
			["get", "own"],
			["call", "method"],
			["get", "g"],
			["set", "own", 5],
			["get", "own"],
			["call", "method"],
			["get", "g"]
		]
	},
	frozen: {
		src: `Object.freeze({ own: 1, method() { return "m:" + this.own; } })`,
		steps: [
			["get", "own"],
			["call", "method"]
		]
	},
	cls: {
		src: `new (class K { #n = 1; constructor() { this.count = 1; } inc() { return ++this.count; } priv() { return ++this.#n; } get dbl() { return this.count * 2; } set dbl(v) { this.count = v / 2; } })()`,
		steps: [
			["get", "count"],
			["call", "inc"],
			["get", "count"],
			["set", "count", 10],
			["call", "inc"],
			["get", "dbl"],
			["set", "dbl", 8],
			["get", "count"],
			["call", "priv"],
			["call", "priv"]
		]
	},
	map: {
		src: `new Map([["a", 1]])`,
		steps: [
			["call", "get", "a"],
			["get", "size"],
			["call", "set", "b", 2],
			["get", "size"],
			["call", "has", "b"]
		]
	},
	arr: {
		src: `[1, 2, 3]`,
		steps: [
			["get", "length"],
			["get", "0"],
			["call", "includes", 3],
			["call", "join", "-"]
		]
	},
	fn: {
		callable: true,
		src: `Object.assign(function main(x) { return "main:" + x; }, { own: 1 })`,
		steps: [
			["apply", 7],
			["get", "own"]
		]
	},
	cproxy: {
		callable: true,
		src: `new Proxy(function pf(x) { return "pf:" + x; }, { get: (t, k) => (k === "dyn" ? "dyn" : Reflect.get(t, k)) })`,
		steps: [
			["apply", 2],
			["get", "dyn"]
		]
	},
	oproxy: {
		src: `new Proxy({ own: 1 }, { get: (t, k) => (k === "dyn" ? "dyn" : Reflect.get(t, k)) })`,
		steps: [
			["get", "own"],
			["get", "dyn"]
		]
	},
	roproxy: {
		src: `new Proxy(Object.freeze({ own: 1 }), { set: () => false, defineProperty: () => false, get: (t, k) => (k === "dyn" ? "dyn" : Reflect.get(t, k)) })`,
		steps: [
			["get", "own"],
			["get", "dyn"]
		]
	},
	prim: { src: `3`, primitive: true },
	zero: { src: `0`, primitive: true },
	nul: { src: `null`, primitive: true }
};

/** Paths: where the module sits, and how its node is reached from the api. */
const PATHS = {
	// A single root file with a callable default makes the api itself callable (single root contributor).
	root: { file: "x.mjs", node: (api, shape) => (shape.callable ? api : api.x) },
	ns: { file: "t/x.mjs", extra: { "t/o.mjs": `export const o = () => "o";` }, node: (api) => api.t.x, siblings: [] },
	self: { file: "x/x.mjs", node: (api) => api.x },
	selfsib: {
		file: "x/x.mjs",
		extra: { "x/a.mjs": `export const a = () => "a";`, "x/z.mjs": `export const z = () => "z";` },
		node: (api) => api.x,
		siblings: ["a", "z"]
	},
	addapi: { file: "x/addapi.mjs", extra: { "x/s.mjs": `export const s = () => "s";` }, node: (api) => api.x, siblings: ["s"] },
	mount: { file: "__mount/addapi.mjs", mount: "__mount", node: (api) => api.m },
	single: { file: "c/only.mjs", node: (api) => api.c.only }
};

/**
 * Build a fresh value from a shape's source, as the module does.
 * @param {string} src - A JS expression.
 * @returns {unknown} The value.
 */
const build = (src) => new Function(`return (${src});`)();

/**
 * Print a value for comparison.
 * @param {unknown} value - The value.
 * @returns {string} Its printed form.
 */
const show = (value) => (typeof value === "function" ? "fn" : value instanceof Map ? "Map" : JSON.stringify(value));

/**
 * Run a step against a target, returning a printable outcome.
 * @param {any} target - The api node or the plain copy.
 * @param {Array} step - `[kind, key, ...args]`.
 * @param {boolean} awaitIt - Await the result (api reads may be promises in lazy mode).
 * @returns {Promise<string>} The outcome.
 */
async function runStep(target, step, awaitIt) {
	const [kind, key, ...args] = step;
	try {
		let value;
		if (kind === "get") value = target[key];
		else if (kind === "set") {
			target[key] = args[0];
			return "set";
		} else if (kind === "call") value = target[key](...args);
		else if (kind === "apply") value = target(key);
		if (awaitIt) value = await value;
		return show(value);
	} catch (error) {
		return "THROW:" + String(error.code || error.message).slice(0, 60);
	}
}

/**
 * Load one cell in one mode and run its checks.
 * @param {string} shapeName - Shape key.
 * @param {string} pathName - Path key.
 * @param {boolean} named - Whether the module also has a named export.
 * @param {"eager"|"lazy"} mode - Mode.
 * @returns {Promise<object>} What the cell answered.
 */
async function runCell(shapeName, pathName, named, mode) {
	const shape = SHAPES[shapeName];
	const p = PATHS[pathName];
	const id = `${shapeName}-${pathName}-${named}-${mode}`;
	const base = path.join(ROOT, id, "api");
	const write = (rel, text) => {
		const file = path.join(base, rel);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, text);
	};
	write(
		p.file,
		`const d = ${shape.src};\n` +
			`(globalThis.__shapeMatrix ??= {})[${JSON.stringify(id)}] = { d, keys: d !== null && (typeof d === "object" || typeof d === "function") ? Reflect.ownKeys(d).map(String) : null };\n` +
			`export default d;\n` +
			(named ? `export const extra = () => "extra";\n` : "")
	);
	for (const [rel, text] of Object.entries(p.extra ?? {})) write(rel, text);
	write("keep.mjs", `export const keep = () => "keep";`);

	const out = { steps: [], errors: [] };
	let api;
	try {
		api = await slothlet({ mode, base, silent: true });
	} catch (error) {
		out.errors.push("BOOT:" + String(error.code || error.message).slice(0, 80));
	}
	try {
		if (api && p.mount) await api.slothlet.api.add("m", path.join(base, p.mount));
		if (api) {
			let node = p.node(api, shape);
			if (mode === "lazy" && node !== undefined && node !== null && typeof node !== "number") {
				try {
					await node;
				} catch {
					// A node that fails to load is reported by the steps below.
				}
				node = p.node(api, shape);
			}
			if (shape.primitive) {
				// Alone, a primitive default is the node's value; beside a named export or siblings it sits under `default`.
				const wrapped = named || (p.siblings ?? []).length > 0;
				out.steps.push(wrapped ? await runStep(node, ["get", "default"], true) : show(await node));
			} else {
				for (const step of shape.steps) out.steps.push(await runStep(node, step, true));
			}
			if (named) out.extra = await runStep(node, ["call", "extra"], true);
			for (const sib of p.siblings ?? []) out[`sib:${sib}`] = await runStep(node, ["call", sib], true);
			try {
				out.keys = Object.keys(node).sort().join(",");
			} catch (error) {
				out.keys = "THROW:" + error.message.slice(0, 60);
			}
			const record = globalThis.__shapeMatrix?.[id];
			if (record?.keys) {
				const added = Reflect.ownKeys(record.d)
					.map(String)
					.filter((key) => !record.keys.includes(key));
				if (added.length) out.errors.push("MUTATED:+" + added.join(","));
			}
		}
	} catch (error) {
		out.errors.push("RUN:" + String(error.code || error.message).slice(0, 100));
	}
	try {
		await api?.shutdown();
	} catch {
		// Shutdown errors are not what this suite checks.
	}
	return out;
}

const CELLS = [];
for (const shapeName of Object.keys(SHAPES)) {
	for (const pathName of Object.keys(PATHS)) {
		for (const named of [false, true]) CELLS.push([shapeName, pathName, named]);
	}
}

describe("default shape × composition path, eager and lazy (#585)", () => {
	afterAll(() => {
		rmSync(ROOT, { recursive: true, force: true });
	});

	it.each(CELLS)("%s default at %s, named export %s", async (shapeName, pathName, named) => {
		const shape = SHAPES[shapeName];
		const expected = [];
		if (!shape.primitive) {
			const plain = build(shape.src);
			for (const step of shape.steps) expected.push(await runStep(plain, step, false));
		}
		const modes = { eager: await runCell(shapeName, pathName, named, "eager"), lazy: await runCell(shapeName, pathName, named, "lazy") };
		const problems = [];
		for (const [mode, out] of Object.entries(modes)) {
			problems.push(...out.errors.map((error) => `${mode}:${error}`));
			if (shape.primitive) {
				if (out.steps[0] !== JSON.stringify(build(shape.src))) problems.push(`${mode}:default=${out.steps[0]}`);
			} else {
				out.steps.forEach((got, index) => {
					if (got !== expected[index])
						problems.push(`${mode}:step${index}(${shape.steps[index].join(" ")}) got ${got} want ${expected[index]}`);
				});
			}
			if (named && out.extra !== '"extra"') problems.push(`${mode}:extra=${out.extra}`);
			for (const sib of PATHS[pathName].siblings ?? [])
				if (out[`sib:${sib}`] !== `"${sib}"`) problems.push(`${mode}:sib ${sib}=${out[`sib:${sib}`]}`);
		}
		if (modes.eager.keys !== modes.lazy.keys) problems.push(`keys differ: eager[${modes.eager.keys}] lazy[${modes.lazy.keys}]`);
		expect(problems).toEqual([]);
	});
});
