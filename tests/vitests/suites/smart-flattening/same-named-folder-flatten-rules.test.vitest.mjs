/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/same-named-folder-flatten-rules.test.vitest.mjs
 *	@Date: 2026-11-13T00:24:03-08:00 (1794558243)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:11:39-08:00 (1794676299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder whose only entry is a same-named folder (#743), combined with each flattening rule: the tree
 * and every node's recorded path, against the shape slothlet 2.11.0 builds for the same folders.
 *
 * @description
 * Fixtures: `tests/vitests/fixtures/folder-collapse-rules/<case>/`. Every function returns `"<file>:<export>"`, so the
 * walk shows which file and export sits at each path, not only that something does. Each case is loaded as a base
 * folder and mounted with `api.slothlet.api.add()` under `zz`, `zz.s`, the case's top folder name (Rule 13) and
 * `zz.<top>`, eager and lazy.
 *
 * Expected trees are the 2.x shape: the output of 2.11.0 (`dir`, `mode`, `api.addApi()`) for the same fixture, walked
 * the same way. Only the cases where 3.x builds that same tree are listed; where the two differ the case is left out
 * (and no tree is asserted for it here). `at` names where a tree applies, relative to the mount: `base`, a mount path,
 * or `<mount>@<mode>` when only that mode builds the 2.x shape.
 *
 * A path in a tree is a namespace; `path -> marker` is a function and what it returns.
 * @module tests/vitests/suites/smart-flattening/same-named-folder-flatten-rules
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures/folder-collapse-rules");

/** The folder each mount goes into: one file, `hold.mjs`. */
const BASE = path.join(FIXTURES, "__base");

/**
 * Per case, the 2.11.0 tree and where it applies.
 * @type {Record<string, Array<{at: string[], tree: string[]}>>}
 */
const CASES = {
	f01_self_named_file: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.a -> e/e/e.mjs:a", "e.b -> e/e/e.mjs:b"] },
		{ at: ["e", "zz.e"], tree: ["a -> e/e/e.mjs:a", "b -> e/e/e.mjs:b"] }
	],
	f02_single_file: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.x", "e.x.a -> e/e/x.mjs:a", "e.x.b -> e/e/x.mjs:b"] },
		{ at: ["e", "zz.e"], tree: ["x", "x.a -> e/e/x.mjs:a", "x.b -> e/e/x.mjs:b"] }
	],
	f04_single_fn_named_as_folder: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.x", "e.x.e -> e/e/x.mjs:e"] },
		{ at: ["e", "zz.e"], tree: ["x", "x.e -> e/e/x.mjs:e"] }
	],
	f05_index: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.index", "e.index.a -> e/e/index.mjs:a", "e.index.b -> e/e/index.mjs:b"] },
		{ at: ["e", "zz.e"], tree: ["index", "index.a -> e/e/index.mjs:a", "index.b -> e/e/index.mjs:b"] }
	],
	f06_callable_default: [{ at: ["base", "zz", "zz.s"], tree: ["e -> e/e/e.mjs:default"] }],
	f07_callable_default_named: [
		{ at: ["base", "zz", "zz.s"], tree: ["e -> e/e/e.mjs:default", "e.a -> e/e/e.mjs:a", "e.b -> e/e/e.mjs:b"] }
	],
	f08_self_plus_sibling: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.a -> e/e/e.mjs:a", "e.y", "e.y.b -> e/e/y.mjs:b"] },
		{ at: ["e", "zz.e"], tree: ["a -> e/e/e.mjs:a", "y", "y.b -> e/e/y.mjs:b"] }
	],
	f10_quad_self_named: [
		{ at: ["base", "zz", "zz.s"], tree: ["x", "x.a -> x/x/x/x.mjs:a"] },
		{ at: ["x", "zz.x"], tree: ["a -> x/x/x/x.mjs:a"] }
	],
	f11_triple_other_file: [
		{ at: ["base", "zz", "zz.s"], tree: ["x", "x.y", "x.y.a -> x/x/x/y.mjs:a"] },
		{ at: ["x", "zz.x"], tree: ["y", "y.a -> x/x/x/y.mjs:a"] }
	],
	f12_not_collapsed: [{ at: ["base", "zz", "zz.s"], tree: ["c", "c.c", "c.c.x", "c.c.x.b -> c/c/x.mjs:b", "c.z", "c.z.a -> c/z.mjs:a"] }],
	f14_object_named_as_folder: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.x", "e.x.e", "e.x.e.a -> e/e/x.mjs:e.a", "e.x.e.b -> e/e/x.mjs:e.b"] },
		{ at: ["e", "zz.e"], tree: ["x", "x.e", "x.e.a -> e/e/x.mjs:e.a", "x.e.b -> e/e/x.mjs:e.b"] }
	],
	f15_self_named_file_object: [{ at: ["base", "zz", "zz.s"], tree: ["e", "e.a -> e/e/e.mjs:e.a", "e.b -> e/e/e.mjs:e.b"] }],
	f17_multi_default: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.a -> e/e/a.mjs:default", "e.b -> e/e/b.mjs:default", "e.h1 -> e/e/h.mjs:h1"] },
		{ at: ["e", "zz.e"], tree: ["a -> e/e/a.mjs:default", "b -> e/e/b.mjs:default", "h1 -> e/e/h.mjs:h1"] }
	],
	f19_addapi_at_root_beside: [
		{ at: ["zz", "zz.s"], tree: ["e", "e.x", "e.x.a -> e/e/x.mjs:a", "r -> addapi.mjs:r"] },
		{ at: ["e@eager", "zz.e"], tree: ["r -> addapi.mjs:r", "x", "x.a -> e/e/x.mjs:a"] }
	],
	f20_cjs_self_named: [{ at: ["base", "zz", "zz.s"], tree: ["e", "e.a -> e/e/e.cjs:a", "e.b -> e/e/e.cjs:b"] }],
	f21_cjs_single_file: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.x", "e.x.a -> e/e/x.cjs:a", "e.x.b -> e/e/x.cjs:b"] },
		{ at: ["e", "zz.e"], tree: ["x", "x.a -> e/e/x.cjs:a", "x.b -> e/e/x.cjs:b"] }
	],
	f23_generic_main: [{ at: ["base", "zz", "zz.s"], tree: ["e", "e.a -> e/e/main.mjs:a"] }],
	f24_inner_holds_other_folder: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.k", "e.k.x", "e.k.x.a -> e/e/k/x.mjs:a"] },
		{ at: ["e", "zz.e"], tree: ["k", "k.x", "k.x.a -> e/e/k/x.mjs:a"] }
	],
	f25_triple_self_named_file: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.a -> e/e/e/e.mjs:a"] },
		{ at: ["e", "zz.e"], tree: ["a -> e/e/e/e.mjs:a"] }
	],
	f26_self_file_plus_folder: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.a -> e/e/e.mjs:a", "e.k", "e.k.x", "e.k.x.b -> e/e/k/x.mjs:b"] },
		{ at: ["e", "zz.e"], tree: ["a -> e/e/e.mjs:a", "k", "k.x", "k.x.b -> e/e/k/x.mjs:b"] }
	],
	f28_not_adjacent: [
		{ at: ["base", "zz", "zz.s"], tree: ["g", "g.h", "g.h.g", "g.h.g.x", "g.h.g.x.a -> g/h/g/x.mjs:a"] },
		{ at: ["g", "zz.g"], tree: ["h", "h.g", "h.g.x", "h.g.x.a -> g/h/g/x.mjs:a"] }
	],
	f29_single_named_fn_matching_folder_plus_other: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.x", "e.x.e -> e/e/x.mjs:e", "e.x.other -> e/e/x.mjs:other"] },
		{ at: ["e", "zz.e"], tree: ["x", "x.e -> e/e/x.mjs:e", "x.other -> e/e/x.mjs:other"] }
	],
	f30_two_files_named: [
		{ at: ["base", "zz", "zz.s"], tree: ["e", "e.x", "e.x.a -> e/e/x.mjs:a", "e.y", "e.y.b -> e/e/y.mjs:b"] },
		{ at: ["e", "zz.e"], tree: ["x", "x.a -> e/e/x.mjs:a", "y", "y.b -> e/e/y.mjs:b"] }
	]
};

/** Root keys that are slothlet's own, not a fixture's node. */
const OWN_ROOT_KEYS = new Set(["slothlet", "shutdown", "destroy", "initialize"]);

/**
 * Walk a node and everything under it: one entry per node, `path` for a namespace and `path -> marker` for a
 * function (a node whose call returns a string). Also collects every node whose recorded path is not its path.
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
 * Load a case and walk what it placed.
 * @param {string} fixture - The case's folder name.
 * @param {string} at - `base`, or the mount path.
 * @param {{mode: string, runtime: string}} config - The load's mode and runtime.
 * @returns {Promise<{tree: string[], drift: string[]}>} The sorted tree and the drifted nodes.
 */
async function load(fixture, at, { mode, runtime }) {
	const dir = path.join(FIXTURES, fixture);
	const out = { tree: [], drift: [] };
	const api = await slothlet({ dir: at === "base" ? dir : BASE, mode, runtime, silent: true });
	try {
		if (at === "base") {
			for (const key of Object.keys(api)) {
				if (!OWN_ROOT_KEYS.has(key)) await walk(api[key], [key], mode === "lazy", out, 0);
			}
		} else {
			await api.slothlet.api.add(at, dir);
			const first = at.split(".")[0];
			await walk(api[first], [first], mode === "lazy", out, 0);
		}
	} finally {
		await api.slothlet.shutdown();
	}
	out.tree.sort();
	return out;
}

/**
 * The full expected tree of a mount: the namespaces of the mount path, then the case's tree under it.
 * @param {string} at - `base`, or the mount path.
 * @param {string[]} tree - The tree relative to the mount.
 * @returns {string[]} The sorted tree.
 */
function expectedTree(at, tree) {
	if (at === "base") return [...tree].sort();
	const segments = at.split(".");
	return [...segments.map((_, index) => segments.slice(0, index + 1).join(".")), ...tree.map((entry) => `${at}.${entry}`)].sort();
}

const ROWS = Object.entries(CASES).flatMap(([fixture, groups]) =>
	groups.flatMap(({ at, tree }) =>
		at.map((where) => {
			const [mount, only] = where.split("@");
			return { fixture, mount, only: only ?? null, tree };
		})
	)
);

describe.each([
	["eager", "async"],
	["eager", "live"],
	["lazy", "async"],
	["lazy", "live"]
])("a same-named folder with each flattening rule builds the 2.x tree (#743) > %s, %s", (mode, runtime) => {
	const rows = ROWS.filter((row) => row.only === null || row.only === mode);

	it.each(rows)("$fixture at $mount", async ({ fixture, mount, tree }) => {
		const { tree: built, drift } = await load(fixture, mount, { mode, runtime });
		expect(built).toEqual(expectedTree(mount, tree));
		expect(drift).toEqual([]);
	});
});
