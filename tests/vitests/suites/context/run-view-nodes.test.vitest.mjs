/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-view-nodes.test.vitest.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A full-isolation run's views of api nodes answer as plain JS answers on a copy of the module's values:
 * accessors, members the run defines, prototypes it gives, arrays it changes, `instanceof`, nodes it writes itself, a
 * namespace only the run created, and the same views once the run has a tree of its own.
 *
 * @description
 * Each test runs one list of steps through `self` inside `run()` / `scope({ isolation: "full" })`, and the same steps on
 * a plain-JS twin of the module's values (the reference), and compares the answers. The instance's own values are
 * unchanged afterwards. A namespace the run creates with a dotted write (`self["ns.child"] = 1`, which slothlet stores
 * as a namespace `ns` holding `child`) answers as an ordinary object holding what the run wrote.
 *
 * Fixture (written at run time): `api/data/data.mjs`, and `extra/extra.mjs`, added inside the run to give it a tree of
 * its own.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { self } from "@cldmv/slothlet/runtime";

const ROOT = path.join(process.cwd(), "tmp", "run-view-nodes");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");

/**
 * The module's values, as source; the twin is built from the same function.
 * @returns {object} The values.
 */
function values() {
	const obj = {
		n: 1,
		get g() {
			return "g" + this.n;
		},
		set s(value) {
			this.n = value;
		},
		get ro() {
			return "ro";
		},
		set wo(value) {
			this.w = value;
		}
	};
	const list = [1, 2, 3];
	class K {
		constructor() {
			this.a = 1;
		}
		m() {
			return "m";
		}
	}
	function fn() {
		return "fn";
	}
	return { obj, list, K, fn };
}

const DATA_SOURCE = `
const values = ${values.toString()};
const made = values();
export const obj = made.obj;
export const list = made.list;
export const K = made.K;
export const fn = made.fn;
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "data"), { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(path.join(BASE, "data", "data.mjs"), DATA_SOURCE);
	writeFileSync(path.join(EXTRA, "extra.mjs"), "export function ping() {\n\treturn 1;\n}\n");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) CONFIGS.push({ mode, runtime });

/**
 * The full-isolation flows.
 * @type {Record<string, function(object, Function): Promise<*>>}
 */
const FLOWS = {
	run: (api, fn) => api.slothlet.context.run({}, fn),
	fullScope: (api, fn) => api.slothlet.context.scope({ context: {}, isolation: "full", fn })
};

/**
 * Run each step, keeping what it returns or the name of what it threw.
 * @param {Array<[string, function(): *]>} steps - The steps, by name.
 * @returns {Array<[string, *]>} The answers, as JSON reads them.
 */
function answers(steps) {
	const out = [];
	for (const [name, step] of steps) {
		try {
			out.push([name, step()]);
		} catch (error) {
			out.push([name, `threw ${error?.name}`]);
		}
	}
	return JSON.parse(JSON.stringify(out, (_key, value) => (value === undefined ? "<undefined>" : value)));
}

/**
 * Steps on the module's values.
 * @param {{obj: object, list: Array, K: Function, fn: Function}} data - The values (`self.data`, or the twin).
 * @returns {Array<[string, function(): *]>} The steps.
 */
function valueSteps(data) {
	const { obj, list, K } = data;
	return [
		["setter on the object", () => [Reflect.set(obj, "s", 5), obj.n, obj.g]],
		["getter only", () => [Reflect.set(obj, "ro", 1), obj.ro]],
		["setter only", () => [obj.wo, Reflect.set(obj, "wo", 3), obj.w]],
		[
			"accessor defined by the run",
			() => {
				Object.defineProperty(obj, "acc", {
					get() {
						return 9;
					},
					configurable: true
				});
				Object.defineProperty(obj, "setOnly", { set() {}, configurable: true });
				return [obj.acc, obj.setOnly, Object.getOwnPropertyDescriptor(obj, "acc").get(), "acc" in obj, Object.keys(obj)];
			}
		],
		[
			"descriptor of a member the run defined",
			() => {
				Object.defineProperty(obj, "dv", { value: 4, writable: false, enumerable: true, configurable: true });
				const described = Object.getOwnPropertyDescriptor(obj, "dv");
				return [described.value, described.writable, described.enumerable];
			}
		],
		["descriptor of a member the run assigned", () => [Reflect.set(obj, "assigned", 1), Object.getOwnPropertyDescriptor(obj, "assigned")]],
		[
			"descriptor of a member the run deleted",
			() => [Reflect.deleteProperty(obj, "assigned"), Object.getOwnPropertyDescriptor(obj, "assigned")]
		],
		["inherited member read", () => typeof obj.hasOwnProperty],
		[
			"prototype given",
			() => {
				Object.setPrototypeOf(obj, { inh: 4 });
				return [obj.inh, "inh" in obj, "n" in obj, Object.getPrototypeOf(obj).inh];
			}
		],
		[
			"null prototype given",
			() => {
				Object.setPrototypeOf(obj, null);
				return [obj.inh, "inh" in obj, obj.toString, Object.getPrototypeOf(obj)];
			}
		],
		[
			"array changes",
			() => {
				Object.defineProperty(list, "0", { value: 9, writable: true, enumerable: true, configurable: true });
				delete list[1];
				list.push(4);
				return [Array.from(list), list.length, Object.keys(list), 1 in list, Object.getOwnPropertyDescriptor(list, "length").value];
			}
		],
		["array non-index member", () => [Reflect.set(list, "label", "x"), list.label, Object.keys(list)]],
		[
			"instanceof",
			() => [1 instanceof K, null instanceof K, {} instanceof K, new K() instanceof K, Object.create(K.prototype) instanceof K]
		],
		["construct and call", () => [new K().a, new K().m(), data.fn()]]
	];
}

/**
 * Steps on an object the run writes itself.
 * @param {object} data - `self.data`, or the twin.
 * @returns {Array<[string, function(): *]>} The steps.
 */
function localSteps(data) {
	return [
		[
			"an object the run wrote",
			() => {
				data.made = { a: 1 };
				const made = data.made;
				made.b = 2;
				Object.defineProperty(made, "c", { value: 3, enumerable: true, configurable: true });
				delete made.a;
				return [made.a, made.b, made.c, Object.keys(made)];
			}
		],
		[
			"its prototype, then closed",
			() => {
				const made = data.made;
				return [
					Reflect.setPrototypeOf(made, { inh: 3 }),
					made.inh,
					Reflect.preventExtensions(made),
					Object.isExtensible(made),
					Reflect.set(made, "late", 1),
					made.late
				];
			}
		]
	];
}

/**
 * Steps on views read before the run had a tree of its own, made after it has one.
 * @param {object} held - Views (or twin values) read before.
 * @param {object} root - `self`, or the twin's root.
 * @returns {Array<[string, function(): *]>} The steps.
 */
function forkedSteps(held, root) {
	const { obj, list, K, fn, data } = held;
	return [
		["assign and read", () => [Reflect.set(obj, "after", 1), obj.after, "after" in obj, "missing" in obj, Object.keys(obj)]],
		["descriptor", () => Object.getOwnPropertyDescriptor(obj, "n")],
		["prototype", () => [Object.getPrototypeOf(obj) === Object.prototype, Object.getPrototypeOf(data) === Object.prototype]],
		["call and construct", () => [fn(), new K().a]],
		["added module", () => root.extra.ping()],
		["array", () => [Object.keys(list), list.length]],
		[
			"delete and define",
			() => [Reflect.deleteProperty(obj, "after"), Reflect.defineProperty(obj, "def", { value: 1, configurable: true }), obj.def]
		],
		["set prototype", () => [Reflect.setPrototypeOf(list, Array.prototype), Array.isArray(list)]],
		["close", () => [Reflect.preventExtensions(obj), Object.isExtensible(obj), Reflect.set(obj, "late", 1), obj.late, Object.keys(obj)]]
	];
}

describe.each(CONFIGS)("Context > run views of api nodes answer as plain JS ($mode, $runtime)", (config) => {
	let api;

	afterEach(async () => {
		await api?.slothlet?.shutdown().catch(() => {});
		api = null;
	});

	/**
	 * A fresh instance, its nodes loaded.
	 * @returns {Promise<object>} The api.
	 */
	async function make() {
		api = await slothlet({ base: BASE, silent: true, ...config });
		await api.data;
		return api;
	}

	/**
	 * What the instance's values show, to compare before and after a run.
	 * @returns {object} The values as JSON shows them.
	 */
	const shown = () => JSON.parse(JSON.stringify({ obj: api.data.obj, list: api.data.list, keys: Object.keys(api) }));

	describe.each(Object.keys(FLOWS))("%s", (flowName) => {
		it("accessors, defined members, prototypes, arrays and instanceof", async () => {
			await make();
			const before = shown();
			const inside = await FLOWS[flowName](api, () => answers(valueSteps(self.data)));
			expect(inside).toEqual(answers(valueSteps(values())));
			expect(shown()).toEqual(before);
		});

		it("an object the run writes is the run's own", async () => {
			await make();
			const inside = await FLOWS[flowName](api, () => answers(localSteps(self.data)));
			expect(inside).toEqual(answers(localSteps(values())));
			expect("made" in api.data).toBe(false);
		});

		it("views read before the run has a tree of its own answer for that tree after", async () => {
			await make();
			const before = shown();
			const inside = await FLOWS[flowName](api, async () => {
				const data = self.data;
				const held = { obj: data.obj, list: data.list, K: data.K, fn: data.fn, data };
				await self.slothlet.api.add("extra", EXTRA);
				return answers(forkedSteps(held, self));
			});
			const twin = values();
			expect(inside).toEqual(answers(forkedSteps({ ...twin, data: {} }, { extra: { ping: () => 1 } })));
			expect(shown()).toEqual(before);
			expect("extra" in api).toBe(false);
		});

		it("a namespace only the run wrote answers as an object holding what it wrote", async () => {
			await make();
			const inside = await FLOWS[flowName](api, () =>
				answers([
					["written", () => Reflect.set(self, "zz.child", 5)],
					["read", () => [typeof self.zz, self.zz.child, "zz" in self]],
					["listed on the root", () => [Object.keys(self).includes("zz"), Object.getOwnPropertyDescriptor(self, "zz")?.enumerable]],
					["assign below", () => [Reflect.set(self.zz, "other", 6), self.zz.other, Object.getOwnPropertyDescriptor(self.zz, "other")]],
					[
						"define and delete below",
						() => [
							Reflect.defineProperty(self.zz, "def", { value: 7, enumerable: true, configurable: true }),
							Reflect.deleteProperty(self.zz, "child"),
							"child" in self.zz,
							"other" in self.zz,
							"missing" in self.zz,
							self.zz.missing,
							Object.keys(self.zz)
						]
					],
					["prototype", () => Object.getPrototypeOf(self.zz) === Object.prototype],
					[
						"prototype given",
						() => [Reflect.setPrototypeOf(self.zz, { inh: 1 }), self.zz.inh, "inh" in self.zz, Object.getPrototypeOf(self.zz).inh]
					],
					["null prototype given", () => [Reflect.setPrototypeOf(self.zz, null), self.zz.inh, "inh" in self.zz, "other" in self.zz]],
					[
						"closed",
						() => [Reflect.preventExtensions(self.zz), Object.isExtensible(self.zz), Reflect.set(self.zz, "late", 1), self.zz.late]
					]
				])
			);
			expect(inside).toEqual([
				["written", true],
				["read", ["object", 5, true]],
				["listed on the root", [true, true]],
				["assign below", [true, 6, { value: 6, writable: true, enumerable: true, configurable: true }]],
				["define and delete below", [true, true, false, true, false, "<undefined>", ["other", "def"]]],
				["prototype", true],
				["prototype given", [true, 1, true, 1]],
				["null prototype given", [true, "<undefined>", false, true]],
				["closed", [true, false, false, "<undefined>"]]
			]);
			expect("zz" in api).toBe(false);
		});
	});
});
