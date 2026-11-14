/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/same-named-folder-mount-hoist.test.vitest.mjs
 *	@Date: 2026-11-13T17:05:22-08:00 (1794618322)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T17:26:29-08:00 (1794619589)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A same-named folder mounted at its own name: Rule 13 (F08) hoists the folder F09 leaves standing for the
 * outer one, once, and every node records the path it is reached at (#743).
 *
 * @description
 * Fixtures: `tests/vitests/fixtures/folder-collapse-mount/<case>/`. Every function returns `"<file>:<export>"`. Each
 * case is loaded as a base folder and mounted with `api.slothlet.api.add()` under `zz`, `zz.s`, its top folder's name
 * and `zz.<top>`, eager and lazy, async and live.
 *
 * Expected trees come from the documented rules (docs/API-RULES/API-FLATTENING.md, docs/API-RULES.md):
 *
 * - F09 (Rule 22): a folder whose only entry is a same-named folder is one level, "the outer folder is dropped and the
 *   inner one stands for it", at initial load and under `api.slothlet.api.add()`. `e/e/e.mjs` is the folder `e/`
 *   holding `e.mjs`.
 * - F01, F02, F04 (Rules 1, 10, 8) then compose that folder as they compose `e/e.mjs`, `e/main.mjs`.
 * - F08 (Rule 13): mounted at `e`, the direct subfolder `e` is hoisted onto the mount, so a mount at the top folder's
 *   name builds what the base load builds. A folder of that name inside the hoisted one stays nested (Rule 13's
 *   `services/services/services.mjs` example; F09's `c/z.mjs` + `c/c/x.mjs`).
 *
 * So one tree per case holds at every placement: the base load's, under the mount prefix (`e.a` at `e`, `zz.e.a` at
 * `zz.e`, `zz.e.a` at `zz`). For each node the test also asserts the path it is reached at is the path it records,
 * the path a hook on it reports and has to name, and the path a permission rule has to name.
 * @module tests/vitests/suites/smart-flattening/same-named-folder-mount-hoist
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures/folder-collapse-mount");

/** The folder each mount goes into, and the module a permission rule is written for: `probe.call(path)`. */
const BASE = path.join(FIXTURES, "__base");

/**
 * Per case: its top folder, the tree as the base load builds it, and paths one level off that must reach nothing
 * when it is mounted at its top folder's name (what was built before the fix).
 * @type {Record<string, {top: string, tree: string[], wrong: string[]}>}
 */
const CASES = {
	r1_self_named_file: { top: "e", tree: ["e", "e.a -> e/e/e.mjs:a", "e.b -> e/e/e.mjs:b"], wrong: ["e.e.a", "e.e.b"] },
	r1_triple_self_named: { top: "x", tree: ["x", "x.a -> x/x/x.mjs:a"], wrong: ["x.x.a"] },
	r1_quad_self_named: { top: "x", tree: ["x", "x.a -> x/x/x/x.mjs:a"], wrong: ["x.x.a"] },
	r2_callable_default: { top: "e", tree: ["e -> e/e/e.mjs:default"], wrong: ["e.e"] },
	r2_callable_default_named: {
		top: "e",
		tree: ["e -> e/e/e.mjs:default", "e.a -> e/e/e.mjs:a", "e.b -> e/e/e.mjs:b"],
		wrong: ["e.e", "e.e.a", "e.e.b"]
	},
	r2_object_named_as_file: { top: "e", tree: ["e", "e.a -> e/e/e.mjs:e.a", "e.b -> e/e/e.mjs:e.b"], wrong: ["e.e.a", "e.e.b"] },
	r2_cjs_object: { top: "e", tree: ["e", "e.a -> e/e/e.cjs:a", "e.b -> e/e/e.cjs:b"], wrong: ["e.e.a", "e.e.b"] },
	r2_cjs_callable: { top: "e", tree: ["e -> e/e/e.cjs:default", "e.a -> e/e/e.cjs:a"], wrong: ["e.e", "e.e.a"] },
	r3_callable_plus_sibling: {
		top: "e",
		tree: ["e -> e/e/e.mjs:default", "e.y", "e.y.b -> e/e/y.mjs:b"],
		wrong: ["e.e", "e.e.y.b"]
	},
	r4_generic_main: { top: "e", tree: ["e", "e.a -> e/e/main.mjs:a"], wrong: ["e.e.a", "e.main.a"] },
	r4_generic_main_uncollapsed: { top: "e", tree: ["e", "e.a -> e/main.mjs:a"], wrong: ["e.main.a"] },
	r5_not_collapsed: {
		top: "c",
		tree: ["c", "c.c", "c.c.x", "c.c.x.b -> c/c/x.mjs:b", "c.z", "c.z.a -> c/z.mjs:a"],
		wrong: ["c.x.b"]
	},
	r5_not_collapsed_self_named: {
		top: "c",
		tree: ["c", "c.c", "c.c.b -> c/c/c.mjs:b", "c.z", "c.z.a -> c/z.mjs:a"],
		wrong: ["c.b"]
	}
};

/** Root keys that are slothlet's own, or the probe's, not a case's node. */
const OWN_ROOT_KEYS = new Set(["slothlet", "shutdown", "destroy", "initialize", "probe"]);

/**
 * Walk a node and everything under it: one entry per node, `path` for a namespace and `path -> marker` for a
 * function. Also collects every node whose recorded path is not the path it is reached at.
 * @param {*} node - Where the walk starts.
 * @param {string[]} keys - The path of `node`.
 * @param {boolean} lazy - Whether to load each node before reading it.
 * @param {{tree: string[], drift: string[]}} out - What the walk found.
 * @param {number} depth - How deep the walk is.
 * @returns {Promise<void>}
 */
async function walk(node, keys, lazy, out, depth) {
	if (lazy) {
		try {
			await node;
		} catch {
			// A node that fails to load is reported as a namespace with nothing under it.
		}
	}
	let marker = null;
	if (typeof node === "function") {
		try {
			const result = await node();
			if (typeof result === "string") marker = result;
		} catch {
			// A namespace node is not callable.
		}
	}
	const at = keys.join(".");
	out.tree.push(marker === null ? at : `${at} -> ${marker}`);
	const recorded = node.__metadata?.apiPath;
	if (recorded !== at) out.drift.push(`${at} records ${recorded}`);
	if (depth > 8) return;
	for (const key of Object.keys(node)) {
		if (key.startsWith("__")) continue;
		await walk(node[key], [...keys, key], lazy, out, depth + 1);
	}
}

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
		try {
			await node;
		} catch {
			// Nothing to load on a missing level.
		}
	}
}

/**
 * Build an instance with the case placed at `at`, and the probe beside it.
 * @param {string} fixture - The case's folder name.
 * @param {string} at - `base`, or the mount path.
 * @param {object} options - Further slothlet options.
 * @returns {Promise<object>} The api.
 */
async function build(fixture, at, options) {
	const dir = path.join(FIXTURES, fixture);
	const api = await slothlet({ dir: at === "base" ? dir : BASE, silent: true, ...options });
	if (at === "base") await api.slothlet.api.add("probe", BASE);
	else await api.slothlet.api.add(at, dir);
	return api;
}

/**
 * A path relative to the mount, under the mount's prefix: the top folder's own name is the mount at `<top>`, so
 * `e.a` is `e.a` there and `zz.e.a` at `zz.e`.
 * @param {string} at - `base`, or the mount path.
 * @param {string} top - The case's top folder.
 * @param {string} relative - The path as the base load has it.
 * @returns {string} The path at that placement.
 */
function placed(at, top, relative) {
	if (at === "base") return relative;
	const prefix = at === top || at.endsWith(`.${top}`) ? at.slice(0, at.length - top.length) : `${at}.`;
	return `${prefix}${relative}`;
}

/**
 * The full expected tree at a placement: the namespaces of the mount prefix, then the case's tree under it.
 * @param {string} at - `base`, or the mount path.
 * @param {string} top - The case's top folder.
 * @param {string[]} tree - The tree as the base load has it.
 * @returns {string[]} The sorted tree.
 */
function expectedTree(at, top, tree) {
	const entries = tree.map((entry) => placed(at, top, entry));
	const prefix = placed(at, top, top).split(".").slice(0, -1);
	return [...prefix.map((_, index) => prefix.slice(0, index + 1).join(".")), ...entries].sort();
}

const ROWS = Object.entries(CASES).flatMap(([fixture, { top, tree, wrong }]) =>
	["base", "zz", "zz.s", top, `zz.${top}`].map((at) => ({
		fixture,
		at,
		top,
		tree,
		leaves: tree.filter((entry) => entry.includes(" -> ")).map((entry) => placed(at, top, entry.split(" -> ")[0])),
		wrong: at === top || at === `zz.${top}` ? wrong.map((entry) => placed(at, top, entry)) : []
	}))
);

describe.each([
	["eager", "async"],
	["eager", "live"],
	["lazy", "async"],
	["lazy", "live"]
])("a same-named folder mounted at its own name is hoisted once (#743) > %s, %s", (mode, runtime) => {
	it.each(ROWS)(
		"$fixture at $at: the tree, and every node records the path it is reached at",
		async ({ fixture, at, top, tree, wrong }) => {
			const api = await build(fixture, at, { mode, runtime });
			try {
				const out = { tree: [], drift: [] };
				if (at === "base") {
					for (const key of Object.keys(api)) {
						if (!OWN_ROOT_KEYS.has(key)) await walk(api[key], [key], mode === "lazy", out, 0);
					}
				} else {
					const first = at.split(".")[0];
					await walk(api[first], [first], mode === "lazy", out, 0);
				}
				out.tree.sort();
				expect(out.tree).toEqual(expectedTree(at, top, tree));
				expect(out.drift).toEqual([]);
				for (const entry of wrong) {
					await load(api, entry);
					expect(reach(api, entry)).toBeUndefined();
				}
			} finally {
				await api.slothlet.shutdown();
			}
		}
	);

	it.each(ROWS)("$fixture at $at: a hook on a node's path fires for it and reports that path", async ({ fixture, at, leaves, wrong }) => {
		const api = await build(fixture, at, { mode, runtime, hook: true });
		try {
			for (const leaf of leaves) {
				const seen = [];
				const ids = [
					api.slothlet.hook.on(`${leaf}:before`, ({ path: apiPath }) => {
						seen.push(["right", apiPath]);
					}),
					...wrong.map((entry) =>
						api.slothlet.hook.on(`${entry}:before`, ({ path: apiPath }) => {
							seen.push(["wrong", apiPath]);
						})
					)
				];
				try {
					await load(api, leaf);
					await reach(api, leaf)();
					// What this asserts is the path: every firing is the hook on the node's own path and reports it. How
					// many times one call fires it is not this test's subject (a lazy callable folder with a sibling file
					// fires it twice, folded or not).
					expect(seen.length).toBeGreaterThan(0);
					expect(seen.filter(([which, apiPath]) => which !== "right" || apiPath !== leaf)).toEqual([]);
				} finally {
					for (const id of ids) api.slothlet.hook.off(id);
				}
			}
		} finally {
			await api.slothlet.shutdown();
		}
	});

	describe.each(["precise", "fast"])("a permission rule names the path a node is reached at (%s)", (attribution) => {
		const permissions = (targets) => ({
			defaultPolicy: "allow",
			attribution,
			rules: targets.map((target) => ({ caller: "probe.**", target, effect: "deny" }))
		});

		it.each(ROWS)(
			"$fixture at $at: a deny on each node's path refuses it, and a deny one level off does not",
			async ({ fixture, at, top, tree, leaves, wrong }) => {
				const markers = Object.fromEntries(
					tree
						.filter((entry) => entry.includes(" -> "))
						.map((entry) => entry.split(" -> "))
						.map(([p, m]) => [placed(at, top, p), m])
				);
				const denied = await build(fixture, at, { mode, runtime, permissions: permissions(leaves) });
				try {
					for (const leaf of leaves) expect(await denied.probe.call(leaf)).toBe("PERMISSION_DENIED");
				} finally {
					await denied.slothlet.shutdown();
				}
				if (wrong.length === 0) return;
				const other = await build(fixture, at, { mode, runtime, permissions: permissions(wrong) });
				try {
					for (const leaf of leaves) expect(await other.probe.call(leaf)).toBe(markers[leaf]);
				} finally {
					await other.slothlet.shutdown();
				}
			}
		);
	});
});
