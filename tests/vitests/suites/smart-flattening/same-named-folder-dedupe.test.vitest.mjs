/**
 * @fileoverview A folder whose only entry is a folder of the same name is one level, and a node's recorded api path
 * is the path it is reached at (#743).
 *
 * @description
 * Fixture `api_test_folder_dedupe`. Every file exports `where()`, which returns the path it is expected at:
 *
 * | Folders                         | Reached at                         |
 * | ------------------------------- | ---------------------------------- |
 * | `a/b/{x,y}.mjs`                 | `api.a.b.x`, `api.a.b.y`           |
 * | `e/e/x.mjs`                     | `api.e.x`                          |
 * | `deep/deep/{part,other}.mjs`    | `api.deep.part`, `api.deep.other`  |
 * | `c/z.mjs` + `c/c/{x,y}.mjs`     | `api.c.z`, `api.c.c.x`, `api.c.c.y` |
 * | `t/t/t/x.mjs`                   | `api.t.x`                          |
 * | `n/side.mjs` + `n/m/m/x.mjs`    | `api.n.side`, `api.n.m.x`          |
 * | `g/h/g/x.mjs`                   | `api.g.h.g.x`                      |
 *
 * Expected values come from #743's table (the 2.x shape): the outer folder is dropped when it holds nothing but the
 * same-named folder, and both levels stay when anything else sits beside it. For each leaf the test asserts that the
 * path it is called at, the path its node records, the path a hook reports and has to name, and the path a
 * permission rule has to name are one and the same.
 * @module tests/vitests/suites/smart-flattening/same-named-folder-dedupe
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_folder_dedupe");

/**
 * Each leaf: the path it is reached at, and a path one level off that must not reach it (the uncollapsed tree, or the
 * path a repeated segment used to be recorded as).
 * @type {Array<{leaf: string, wrong: string}>}
 */
const LEAVES = [
	{ leaf: "a.b.x.where", wrong: "a.x.where" },
	{ leaf: "a.b.y.where", wrong: "a.y.where" },
	{ leaf: "e.x.where", wrong: "e.e.x.where" },
	{ leaf: "deep.part.where", wrong: "deep.deep.part.where" },
	{ leaf: "deep.other.where", wrong: "deep.deep.other.where" },
	{ leaf: "c.z.where", wrong: "z.where" },
	{ leaf: "c.c.x.where", wrong: "c.x.where" },
	{ leaf: "c.c.y.where", wrong: "c.y.where" },
	{ leaf: "t.x.where", wrong: "t.t.x.where" },
	{ leaf: "n.side.where", wrong: "side.where" },
	{ leaf: "n.m.x.where", wrong: "n.m.m.x.where" },
	{ leaf: "g.h.g.x.where", wrong: "g.h.x.where" }
];

/**
 * Read a dotted path off a root.
 * @param {object} root - The api.
 * @param {string} dotted - The path.
 * @returns {*} What is there, or undefined when a level is missing.
 */
function reach(root, dotted) {
	let node = root;
	for (const key of dotted.split(".")) {
		if (node === null || node === undefined) return undefined;
		node = node[key];
	}
	return node;
}

/**
 * Load every lazy folder on the way to a path. A no-op in eager mode.
 * @param {object} root - The api.
 * @param {string} dotted - The path.
 * @returns {Promise<void>}
 */
async function load(root, dotted) {
	let node = root;
	for (const key of dotted.split(".")) {
		if (node === null || node === undefined) return;
		node = node[key];
		await node;
	}
}

describe.each([
	["eager", "async"],
	["eager", "live"],
	["lazy", "async"],
	["lazy", "live"]
])("same-named folders (#743) > %s, %s", (mode, runtime) => {
	describe("the tree and the recorded path", () => {
		let api;
		beforeAll(async () => {
			api = await slothlet({ dir: DIR, mode, runtime, silent: true, hook: true });
		});
		afterAll(async () => {
			await api.slothlet.shutdown();
		});

		it.each(LEAVES)("$leaf is called at that path", async ({ leaf }) => {
			expect(await reach(api, leaf)()).toBe(leaf);
		});

		it.each(LEAVES)("nothing is at $wrong", async ({ leaf, wrong }) => {
			await load(api, leaf);
			await load(api, wrong);
			expect(reach(api, wrong)).toBeUndefined();
		});

		it.each(LEAVES)("$leaf records the path it is reached at, level by level", async ({ leaf }) => {
			await load(api, leaf);
			const keys = leaf.split(".");
			for (let length = 1; length <= keys.length; length++) {
				const at = keys.slice(0, length).join(".");
				expect(reach(api, at).__metadata.apiPath).toBe(at);
			}
		});

		it.each(LEAVES)("a hook on exactly $leaf fires for it and reports that path", async ({ leaf, wrong }) => {
			const seen = [];
			const right = api.slothlet.hook.on(`${leaf}:before`, ({ path: apiPath }) => {
				seen.push(["right", apiPath]);
			});
			const off = api.slothlet.hook.on(`${wrong}:before`, ({ path: apiPath }) => {
				seen.push(["wrong", apiPath]);
			});
			try {
				await reach(api, leaf)();
				expect(seen).toEqual([["right", leaf]]);
			} finally {
				api.slothlet.hook.off(right);
				api.slothlet.hook.off(off);
			}
		});

		it("the collapsed folders hold their files and no folder of their own name", async () => {
			await load(api, "e.x");
			await load(api, "deep.part");
			await load(api, "t.x");
			await load(api, "n.m.x");
			expect(Object.keys(api.e)).toEqual(["x"]);
			expect(Object.keys(api.deep).sort()).toEqual(["other", "part"]);
			expect(Object.keys(api.t)).toEqual(["x"]);
			expect(Object.keys(api.n.m)).toEqual(["x"]);
			expect(Object.keys(api.c).sort()).toEqual(["c", "z"]);
		});
	});

	describe.each(["precise", "fast"])("a permission rule names the path the leaf is reached at (%s)", (attribution) => {
		it.each(LEAVES)("a deny on $leaf refuses it, and a deny on $wrong does not", async ({ leaf, wrong }) => {
			const build = (target) =>
				slothlet({
					dir: DIR,
					mode,
					runtime,
					silent: true,
					permissions: { defaultPolicy: "allow", attribution, rules: [{ caller: "probe.**", target, effect: "deny" }] }
				});
			const denied = await build(leaf);
			try {
				expect(await denied.probe.call(leaf)).toBe("PERMISSION_DENIED");
			} finally {
				await denied.slothlet.shutdown();
			}
			const other = await build(wrong);
			try {
				expect(await other.probe.call(leaf)).toBe(leaf);
			} finally {
				await other.slothlet.shutdown();
			}
		});
	});
});
