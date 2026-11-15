/**
 * @fileoverview A function default's named exports called `name`, `length` or `prototype` are
 * members of its node.
 *
 * @description
 * Plain JavaScript is the reference: each fixture is also imported as a plain module, and the node answers what the
 * module's namespace gives (`ns.name`, `ns.calc`, `ns.default(…)`).
 *
 * - `export const name = "N"` beside `export default function calc` reads `"N"` at `api.math.calc.name` (and likewise
 *   `length` and `prototype`): a function's own `name`, `length` and `prototype` are the language's, so a named export
 *   of that name does not conflict with the default (MODULE-STRUCTURE.md). A member the module put on its function
 *   itself still conflicts and, under `merge`, keeps the function's.
 *
 * Every row runs eager and lazy, async and live, from files and from in-memory `api.slothlet.api.add`, and with the
 * permission system on under both `attribution` values.
 *
 * @module tests/vitests/suites/smart-flattening/function-default-member-names
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const DIR = path.join(process.cwd(), "tmp", `function-default-member-names-${process.pid}-${Date.now()}`);
const BASE = path.join(DIR, "api");

/** The fixture files, by path under the api folder. */
const FILES = {
	"math/calc.mjs": [
		"export default function calc(a, b) { return a + b; }",
		'function calc2() { return "calc2"; }',
		"export { calc2 as calc };",
		'export const name = "N";',
		"export const length = 7;",
		'export function helper() { return "helper"; }'
	].join("\n"),
	"math/other.mjs": 'export function other() { return "other"; }',
	"shape/proto.mjs": ["export default function proto() { return 1; }", 'export const prototype = "P";', 'export const tag = "t";'].join(
		"\n"
	),
	"shape/other.mjs": 'export function other() { return "other"; }',
	"solo/solo.mjs": [
		"export default function solo(a, b) { return a * b; }",
		'function solo2() { return "solo2"; }',
		"export { solo2 as solo };",
		'export const name = "S";'
	].join("\n"),
	"pair/pair.mjs": [
		'export default function pair() { return "pair"; }',
		'function pair2() { return "pair2"; }',
		"export { pair2 as pair };",
		"export const length = 4;"
	].join("\n"),
	"pair/side.mjs": 'export function side() { return "side"; }',
	"klass/klass.mjs": [
		"export default class Klass { constructor() { this.v = 1; } }",
		'export const prototype = "P";',
		'export const name = "K";'
	].join("\n"),
	"klass/side.mjs": 'export function side() { return "side"; }',
	"own/own.mjs": [
		'function own() { return "own"; }',
		'own.tag = "own-tag";',
		"export default own;",
		'export const tag = "named-tag";'
	].join("\n"),
	"own/side.mjs": 'export function side() { return "side"; }',
	"later/af.mjs": ['export default async function af() { return "af"; }', 'export function extra() { return "extra"; }'].join("\n"),
	"later/other.mjs": 'export function other() { return "other"; }',
	"reader/reader.mjs": [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function readName() { return self.math.calc.name; }",
		"export function readLength() { return self.math.calc.length; }",
		"export function readCalc() { return self.math.calc.calc(); }",
		"export function listKeys() { return Object.keys(self.math.calc); }"
	].join("\n")
};

/** The plain modules, imported as plain JavaScript imports them. */
const plain = {};

/** The in-memory export map that matches the `math/calc.mjs` file. */
const memCalc = () => ({
	default: function calc(a, b) {
		return a + b;
	},
	calc: function calc2() {
		return "calc2";
	},
	name: "N",
	length: 7,
	helper() {
		return "helper";
	}
});

beforeAll(async () => {
	for (const [file, source] of Object.entries(FILES)) {
		mkdirSync(path.dirname(path.join(BASE, file)), { recursive: true });
		writeFileSync(path.join(BASE, file), `${source}\n`);
	}
	for (const file of ["math/calc.mjs", "shape/proto.mjs", "solo/solo.mjs", "pair/pair.mjs", "klass/klass.mjs", "own/own.mjs"]) {
		plain[file] = await import(`${pathToFileURL(path.join(BASE, file)).href}?plain-twin`);
	}
});

afterAll(() => {
	rmSync(DIR, { recursive: true, force: true });
});

describe.each(getMatrixConfigs())("function default member names > $name", ({ config }) => {
	let api;

	/**
	 * Build the instance and load the nodes read below.
	 * @returns {Promise<object>} The api.
	 */
	async function build() {
		api = await slothlet({ ...config, base: BASE, collision: { initial: "merge", api: "merge" }, silent: true });
		for (const key of ["math", "shape", "solo", "pair", "klass", "own", "later"]) await api[key];
		for (const node of [api.math.calc, api.shape.proto, api.later.af]) await node;
		return api;
	}

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("reads a named export called name or length as the member, as the module's namespace does", async () => {
		await build();
		const ns = plain["math/calc.mjs"];
		expect(api.math.calc(2, 3)).toBe(ns.default(2, 3));
		expect(api.math.calc.name).toBe(ns.name);
		expect(api.math.calc.length).toBe(ns.length);
		expect(api.math.calc.helper()).toBe(ns.helper());
		expect(Object.keys(api.math.calc)).toEqual(expect.arrayContaining(["name", "length", "helper"]));
	});

	it("reads a named export called prototype as the member", async () => {
		await build();
		const ns = plain["shape/proto.mjs"];
		expect(api.shape.proto()).toBe(ns.default());
		expect(api.shape.proto.prototype).toBe(ns.prototype);
		expect(api.shape.proto.tag).toBe(ns.tag);
	});

	it("reads a class default's prototype and name exports as members and still constructs the class", async () => {
		await build();
		const ns = plain["klass/klass.mjs"];
		expect(api.klass.prototype).toBe(ns.prototype);
		expect(api.klass.name).toBe(ns.name);
		expect(new api.klass().v).toBe(new ns.default().v);
		expect(await api.klass.side()).toBe("side");
	});

	it("keeps a member the module put on its function itself under merge", async () => {
		await build();
		const ns = plain["own/own.mjs"];
		expect(api.own()).toBe(ns.default());
		expect(api.own.tag).toBe(ns.default.tag);
	});

	it("composes an in-memory add's name and length exports as the file's", async () => {
		await build();
		await api.slothlet.api.add("mem.calc", memCalc());
		await api.mem;
		await api.mem.calc;
		const ns = plain["math/calc.mjs"];
		expect(api.mem.calc(2, 3)).toBe(ns.default(2, 3));
		expect(api.mem.calc.name).toBe(ns.name);
		expect(api.mem.calc.length).toBe(ns.length);
		expect(api.mem.calc.helper()).toBe(ns.helper());
	});
});

describe.each(
	["eager", "lazy"].flatMap((mode) =>
		["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
	)
)("function default member names, permissions on > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the instance with a rule refusing the reader `math.calc.name`.
	 * @returns {Promise<object>} The api.
	 */
	async function build() {
		api = await slothlet({
			mode,
			runtime,
			base: BASE,
			silent: true,
			permissions: {
				defaultPolicy: "allow",
				attribution,
				rules: [{ caller: "reader.**", target: "math.calc.name", effect: "deny" }]
			}
		});
		await api.math;
		await api.math.calc;
		await api.reader;
		return api;
	}

	it("holds a member called name to its own path's rules", async () => {
		await build();
		const ns = plain["math/calc.mjs"];
		expect(api.math.calc.name).toBe(ns.name);
		await expect(Promise.resolve().then(() => api.reader.readName())).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
		expect(await api.reader.readLength()).toBe(ns.length);
		const listed = await api.reader.listKeys();
		expect(listed).not.toContain("name");
		expect(listed).toEqual(expect.arrayContaining(["length", "helper"]));
	});
});
