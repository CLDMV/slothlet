/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-synthetic-default-members.test.vitest.mjs
 *	@Date: 2026-11-14T21:57:17-08:00 (1794722237)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T23:02:12-08:00 (1794726132)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An in-memory module whose default export is a function keeps its other exports as members.
 *
 * @description
 * `api.slothlet.api.add("calc", { exports: { default: calc, extra } })` composes like a file with the same exports
 * added by path (API-FLATTENING F04/F05): `api.calc()` is the default, and `api.calc.extra()` is a member api node at
 * `calc.extra`, as `import calc, { extra } from "./calc.mjs"` gives both in plain JavaScript. Each shape here is
 * added twice, once in memory (`mem.*`) and once as a file with the same exports (`file.*`), and both are held to the
 * plain-JS twin: the default's call, the member's call, the member's recorded path, the members listed, a hook on the
 * member, a rule on the member, what the member's own code runs as (an in-memory leaf is its own entity at its path,
 * #717), and `reload()` / `remove()` of the add.
 *
 * @module tests/vitests/suites/api-manager/api-manager-synthetic-default-members
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_leaf_body_mutable_arg/api");
const DIR = path.join(process.cwd(), "tmp", `synthetic-default-members-${process.pid}-${Date.now()}`);
// Each block builds its instance and mounts once in beforeAll; a cold build on a loaded runner can pass 10 s.
const HOOK_TIMEOUT = 60_000;

/**
 * The shapes: an in-memory export map, the same exports as file source, and what plain JS gives for them.
 * @type {Array<{ kind: string, mem: () => Record<string, unknown>, src: string, call: (node: Function) => unknown, plain: unknown }>}
 */
const SHAPES = [
	{
		kind: "function",
		mem: () => ({
			default: function calc() {
				return "calc";
			},
			extra() {
				return "extra";
			}
		}),
		src: `export default function calc() { return "calc"; }\nexport function extra() { return "extra"; }\n`,
		call: (node) => node(),
		plain: "calc"
	},
	{
		kind: "async function",
		mem: () => ({
			default: async function calc() {
				return "calc";
			},
			extra() {
				return "extra";
			}
		}),
		src: `export default async function calc() { return "calc"; }\nexport function extra() { return "extra"; }\n`,
		call: (node) => node(),
		plain: "calc"
	},
	{
		kind: "arrow function",
		mem: () => ({ default: () => "calc", extra: () => "extra" }),
		src: `export default () => "calc";\nexport const extra = () => "extra";\n`,
		call: (node) => node(),
		plain: "calc"
	},
	{
		kind: "class",
		mem: () => ({
			default: class Calc {
				hi() {
					return "calc";
				}
			},
			extra() {
				return "extra";
			}
		}),
		src: `export default class Calc { hi() { return "calc"; } }\nexport function extra() { return "extra"; }\n`,
		call: (node) => new node().hi(),
		plain: "calc"
	}
];

/**
 * The plain-JS twin of a shape: its exports used as JavaScript gives them.
 * @param {object} shape - A shape of SHAPES.
 * @returns {{ call: unknown, extra: unknown }} The default's call and the member's call.
 */
async function plainTwin(shape) {
	const exportsMap = shape.mem();
	return { call: await shape.call(exportsMap.default), extra: await exportsMap.extra() };
}

/**
 * What an api node at `segments` gives: its type, its call, the members listed, and its member `extra`.
 * @param {object} api - The api.
 * @param {string[]} segments - The node's path.
 * @param {object} shape - The shape added there.
 * @returns {Promise<object>} The summary.
 */
async function summary(api, segments, shape) {
	let node = api;
	for (const segment of segments) node = node[segment];
	return {
		type: typeof node,
		call: await shape.call(node),
		extra: await node.extra(),
		extraType: typeof node.extra,
		extraPath: node.extra.__metadata?.apiPath,
		listed: Object.keys(node).includes("extra")
	};
}

/**
 * Write a shape's file twin and return its path.
 * @param {string} name - A folder name for it.
 * @param {string} src - The file source.
 * @returns {string} The file path.
 */
function fileTwin(name, src) {
	const dir = path.join(DIR, name);
	mkdirSync(dir, { recursive: true });
	const file = path.join(dir, "calc.mjs");
	writeFileSync(file, src);
	return file;
}

const SHAPE_CONFIGS = ["eager", "lazy"].flatMap((mode) => ["async", "live"].map((runtime) => ({ mode, runtime })));

afterAll(() => {
	rmSync(DIR, { recursive: true, force: true });
});

describe.each(SHAPE_CONFIGS)("in-memory default function + named exports — $mode/$runtime", ({ mode, runtime }) => {
	let api;
	let n = 0;

	beforeAll(async () => {
		api = await slothlet({
			base: FIXTURE,
			mode,
			runtime,
			silent: true,
			hook: { enabled: true },
			api: { collision: { api: "merge" }, mutations: { add: true, remove: true, reload: true } }
		});
	}, HOOK_TIMEOUT);

	afterAll(async () => {
		await api?.slothlet.shutdown();
	});

	describe.each(SHAPES)("a $kind default", (shape) => {
		it.each([
			["a new path", (key) => [`new${key}`, "calc"]],
			["a nested path", (key) => [`nest${key}`, "deep", "calc"]]
		])("keeps the other exports as members at %s, as the file twin and plain JS do", async (_label, at) => {
			const key = ++n;
			const memPath = ["mem", ...at(key)];
			const filePath = ["file", ...at(key)];
			await api.slothlet.api.add(memPath.join("."), { exports: shape.mem() });
			await api.slothlet.api.add(filePath.join("."), fileTwin(`s${key}`, shape.src));
			const plain = await plainTwin(shape);
			const mem = await summary(api, memPath, shape);
			const file = await summary(api, filePath, shape);

			expect(mem.call).toBe(plain.call);
			expect(mem.extra).toBe(plain.extra);
			expect(mem).toEqual({ ...file, extraPath: `${memPath.join(".")}.extra` });
			expect(file.extraPath).toBe(`${filePath.join(".")}.extra`);
			expect(mem.listed).toBe(true);
		});

		it("keeps the other exports as members at an existing path, as the file twin does", async () => {
			const key = ++n;
			await api.slothlet.api.add(`mem.have${key}.calc`, { exports: { existing: () => "existing" } });
			await api.slothlet.api.add(`file.have${key}.calc`, { exports: { existing: () => "existing" } });
			await api.slothlet.api.add(`mem.have${key}.calc`, { exports: shape.mem() });
			await api.slothlet.api.add(`file.have${key}.calc`, fileTwin(`e${key}`, shape.src));
			const plain = await plainTwin(shape);
			const mem = await summary(api, ["mem", `have${key}`, "calc"], shape);
			const file = await summary(api, ["file", `have${key}`, "calc"], shape);

			expect(mem.call).toBe(plain.call);
			expect(mem.extra).toBe(plain.extra);
			expect(mem).toEqual({ ...file, extraPath: `mem.have${key}.calc.extra` });
			expect(await api.mem[`have${key}`].calc.existing()).toBe(await api.file[`have${key}`].calc.existing());
		});

		it("runs a hook on the member, as for the file twin", async () => {
			const key = ++n;
			await api.slothlet.api.add(`mem.hook${key}.calc`, { exports: shape.mem() });
			await api.slothlet.api.add(`file.hook${key}.calc`, fileTwin(`h${key}`, shape.src));
			const seen = [];
			api.slothlet.hook.on(`mem.hook${key}.calc.extra:before`, ({ path: p }) => {
				seen.push(p);
			});
			api.slothlet.hook.on(`file.hook${key}.calc.extra:before`, ({ path: p }) => {
				seen.push(p);
			});
			await api.mem[`hook${key}`].calc.extra();
			await api.file[`hook${key}`].calc.extra();
			expect(seen).toEqual([`mem.hook${key}.calc.extra`, `file.hook${key}.calc.extra`]);
		});

		it("keeps the members across reload() and removes them with the add", async () => {
			const key = ++n;
			const memID = await api.slothlet.api.add(`mem.rl${key}.calc`, { exports: shape.mem() });
			const fileID = await api.slothlet.api.add(`file.rl${key}.calc`, fileTwin(`r${key}`, shape.src));
			// The file twin is not reloaded by moduleID here: what it gives once added is the reference.
			const file = await summary(api, ["file", `rl${key}`, "calc"], shape);
			await api.slothlet.api.reload(memID);
			const mem = await summary(api, ["mem", `rl${key}`, "calc"], shape);
			expect(mem).toEqual({ ...file, extraPath: `mem.rl${key}.calc.extra` });
			expect(mem.extra).toBe("extra");

			await api.slothlet.api.remove(memID);
			await api.slothlet.api.remove(fileID);
			expect(api.mem[`rl${key}`]?.calc).toBe(api.file[`rl${key}`]?.calc);
			expect(api.mem[`rl${key}`]?.calc).toBeUndefined();
		});
	});

	it("keeps the members across a full reload() of the instance", async () => {
		await api.slothlet.api.add("mem.full.calc", { exports: SHAPES[0].mem() });
		await api.slothlet.reload();
		expect(api.mem.full.calc()).toBe("calc");
		expect(await api.mem.full.calc.extra()).toBe("extra");
		expect(api.mem.full.calc.extra.__metadata?.apiPath).toBe("mem.full.calc.extra");
	});

	it("keeps an in-memory default function with no other export a plain callable leaf", async () => {
		await api.slothlet.api.add("mem.alone.calc", { exports: { default: () => "alone" } });
		expect(api.mem.alone.calc()).toBe("alone");
		expect(Object.keys(api.mem.alone.calc)).toEqual([]);
	});

	it("keeps a default function's own properties as members, as the file twin does", async () => {
		const own = function calc() {
			return "calc";
		};
		own.extra = function extra() {
			return "extra";
		};
		await api.slothlet.api.add("mem.own.calc", { exports: { default: own } });
		await api.slothlet.api.add(
			"file.own.calc",
			fileTwin("own", `function calc() { return "calc"; }\ncalc.extra = function extra() { return "extra"; };\nexport default calc;\n`)
		);
		expect(api.mem.own.calc()).toBe(own());
		expect(api.file.own.calc()).toBe(own());
		expect(await api.mem.own.calc.extra()).toBe(own.extra());
		expect(await api.file.own.calc.extra()).toBe(own.extra());
	});
});

const PERMISSION_CONFIGS = SHAPE_CONFIGS.flatMap((config) => ["precise", "fast"].map((attribution) => ({ ...config, attribution })));

describe.each(PERMISSION_CONFIGS)(
	"in-memory default function + named exports under rules — $mode/$runtime/$attribution",
	({ mode, runtime, attribution }) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({
				base: FIXTURE,
				mode,
				runtime,
				silent: true,
				api: { mutations: { add: true, remove: true, reload: true } },
				permissions: {
					defaultPolicy: "deny",
					attribution,
					rules: [
						{ caller: "**", target: "vault.whoami", effect: "allow" },
						{ caller: "mem.**", target: "vault.get", effect: "allow" },
						{ caller: "file.**", target: "vault.get", effect: "allow" },
						{ caller: "ask.**", target: "mem.calc", effect: "allow" },
						{ caller: "ask.**", target: "file.calc", effect: "allow" }
					]
				}
			});
			const getApi = () => api;
			await api.slothlet.api.add("mem.calc", {
				exports: {
					default: function calc() {
						return getApi().vault.whoami();
					},
					extra() {
						return { who: getApi().vault.whoami(), vault: getApi().vault.get() };
					}
				}
			});
			const file = fileTwin(
				`perm-${mode}-${runtime}-${attribution}`,
				`import { self } from "@cldmv/slothlet/runtime";\n` +
					`export default function calc() { return self.vault.whoami(); }\n` +
					`export function extra() { return { who: self.vault.whoami(), vault: self.vault.get() }; }\n`
			);
			await api.slothlet.api.add("file.calc", file);
			await api.slothlet.api.add("ask", {
				exports: {
					call(where) {
						try {
							return getApi()[where].calc();
						} catch (error) {
							return error?.code;
						}
					},
					member(where) {
						try {
							return getApi()[where].calc.extra();
						} catch (error) {
							return error?.code;
						}
					}
				}
			});
		}, HOOK_TIMEOUT);

		afterAll(async () => {
			await api?.slothlet.shutdown();
		});

		it("runs the member's own code as the member's path, as the file twin's runs as its own", async () => {
			expect(await api.mem.calc.extra()).toEqual({ who: "mem.calc.extra", vault: "secret" });
			expect(await api.file.calc.extra()).toEqual({ who: "file.calc.extra", vault: "secret" });
			expect(await api.mem.calc()).toBe("mem.calc");
			expect(await api.file.calc()).toBe("file.calc");
		});

		it("holds the member to the rules on its own path, as the file twin's member", async () => {
			// `ask.**` may call `mem.calc` and `file.calc`, but no rule lets it call their member.
			expect(await api.ask.call("mem")).toBe("mem.calc");
			expect(await api.ask.call("file")).toBe("file.calc");
			expect(await api.ask.member("mem")).toBe("PERMISSION_DENIED");
			expect(await api.ask.member("file")).toBe("PERMISSION_DENIED");
		});
	}
);
