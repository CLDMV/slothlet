/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/single-file-default.mjs
 *	@Date: 2026-11-14T08:36:40-08:00 (1794674200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:08:57-08:00 (1794676137)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Cases and helpers for the single-file-default tests (#773): a folder whose only file has a default-export function is that function, whatever the file or the
 * function is called (F05, #773); the file's other exports are its members.
 *
 * @description
 * Fixtures: `tests/vitests/fixtures/single-file-default/<case>/`. Every function returns `"<file>:<export>"`. Each case
 * is loaded as a base folder and mounted with `api.slothlet.api.add()` under `zz`, `zz.s`, its top folder's name and
 * `zz.<top>`, eager and lazy, async and live.
 *
 * Expected trees come from the documented rules (docs/API-RULES/API-FLATTENING.md, docs/API-RULES.md):
 *
 * - F05 (Rule 8): "A folder has one file with a default export (filenames need not match) → Default export promoted to
 *   folder name": `e/x.mjs` with `export default function run` and `export function helper` is `api.e()` and
 *   `api.e.helper()`, as v2.11.0 built it. The `p*` cases.
 * - A single file with no default export keeps its own level (Rules 2 and 7, C07): `e/x.mjs` exporting `x` is
 *   `api.e.x()`. A default-export object or Map is no function and keeps the file's level too. Two entries in the
 *   folder keep their levels. A file named like its folder (F01/F04), a generic entry name (F02) and an `addapi` file
 *   (F06) compose as they always have. The `n*` cases.
 *
 * Every function the tree holds is compared with the same file imported plainly (`import run, { helper } from
 * "./e/x.mjs"`). For each node the test also asserts the path it is reached at is the path it records, the path a hook
 * on it reports and has to name (once per call), and the path a permission rule has to name.
 * @module tests/vitests/setup/single-file-default
 */

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

export const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/single-file-default");

/** The folder each mount goes into, and the module a permission rule is written for: `probe.call(path)`. */
export const BASE = path.join(FIXTURES, "__base");

/**
 * Per case: its top folder, the tree as the base load builds it (`path` a namespace, `path -> marker` a function,
 * `path = value` a value), the file each function comes from with the export it is (`path: [file, export]`, for the
 * plain-JS twin), and the paths the folder was built at before the fix, which must reach nothing now.
 * @type {Record<string, {top: string, tree: string[], twin?: Record<string, [string, string]>, wrong?: string[]}>}
 */
export const CASES = {
	p1_issue: {
		top: "e",
		tree: ["e -> e/x.mjs:default", "e.helper -> e/x.mjs:helper"],
		twin: { e: ["e/x.mjs", "default"], "e.helper": ["e/x.mjs", "helper"] },
		wrong: ["e.x", "e.x.helper"]
	},
	p2_doc_example: {
		top: "processor",
		tree: ["processor -> processor/process.mjs:default"],
		twin: { processor: ["processor/process.mjs", "default"] },
		wrong: ["processor.process"]
	},
	p3_default_only: {
		top: "e",
		tree: ["e -> e/x.mjs:default"],
		twin: { e: ["e/x.mjs", "default"] },
		wrong: ["e.x"]
	},
	p4_default_many: {
		top: "e",
		tree: ["e -> e/x.mjs:default", "e.helper -> e/x.mjs:helper", "e.limit = 3", "e.other -> e/x.mjs:other"],
		twin: { e: ["e/x.mjs", "default"], "e.helper": ["e/x.mjs", "helper"], "e.other": ["e/x.mjs", "other"] },
		wrong: ["e.x", "e.x.helper", "e.x.other"]
	},
	p5_async: {
		top: "e",
		tree: ["e -> e/x.mjs:default", "e.helper -> e/x.mjs:helper"],
		twin: { e: ["e/x.mjs", "default"], "e.helper": ["e/x.mjs", "helper"] },
		wrong: ["e.x", "e.x.helper"]
	},
	p6_cjs: {
		top: "e",
		tree: ["e -> e/x.cjs:default", "e.helper -> e/x.cjs:helper"],
		twin: { e: ["e/x.cjs", "default"], "e.helper": ["e/x.cjs", "helper"] },
		wrong: ["e.x", "e.x.helper"]
	},
	p7_nested: {
		top: "a",
		tree: ["a", "a.e -> a/e/x.mjs:default", "a.e.helper -> a/e/x.mjs:helper"],
		twin: { "a.e": ["a/e/x.mjs", "default"], "a.e.helper": ["a/e/x.mjs", "helper"] },
		wrong: ["a.e.x", "a.e.x.helper"]
	},
	p8_generic_default: {
		top: "e",
		tree: ["e -> e/index.mjs:default", "e.helper -> e/index.mjs:helper"],
		twin: { e: ["e/index.mjs", "default"], "e.helper": ["e/index.mjs", "helper"] },
		wrong: ["e.index", "e.index.helper"]
	},
	n1_named_fn_other_name: { top: "e", tree: ["e", "e.x -> e/x.mjs:x"] },
	n2_named_object: { top: "e", tree: ["e", "e.x", "e.x.a -> e/x.mjs:x.a", "e.x.b -> e/x.mjs:x.b"] },
	n3_object_default: { top: "e", tree: ["e", "e.x", "e.x.a -> e/x.mjs:a", "e.x.b -> e/x.mjs:b"] },
	n4_map_default: { top: "e", tree: ["e", "e.x"] },
	n5_two_files: { top: "e", tree: ["e", "e.x -> e/x.mjs:default", "e.y", "e.y.b -> e/y.mjs:b"] },
	n6_file_and_folder: { top: "e", tree: ["e", "e.sub", "e.sub.s -> e/sub/s.mjs:s", "e.x -> e/x.mjs:default"] },
	n7_self_named: { top: "e", tree: ["e -> e/e.mjs:default", "e.helper -> e/e.mjs:helper"] },
	n8_generic_named: { top: "e", tree: ["e", "e.a -> e/main.mjs:a"] },
	n9_addapi: { top: "e", tree: ["e", "e.a -> e/addapi.mjs:a"] }
};

/** Root keys that are slothlet's own, or the probe's, not a case's node. */
export const OWN_ROOT_KEYS = new Set(["slothlet", "shutdown", "destroy", "initialize", "probe"]);

/**
 * Walk a node and everything under it: one entry per node, `path` for a namespace, `path -> marker` for a function
 * and `path = value` for a value. Also collects every node whose recorded path is not the path it is reached at.
 * @param {*} node - Where the walk starts.
 * @param {string[]} keys - The path of `node`.
 * @param {boolean} lazy - Whether to load each node before reading it.
 * @param {{tree: string[], drift: string[]}} out - What the walk found.
 * @param {number} depth - How deep the walk is.
 * @returns {Promise<void>}
 */
export async function walk(node, keys, lazy, out, depth) {
	const at = keys.join(".");
	if (node === null || (typeof node !== "object" && typeof node !== "function")) {
		out.tree.push(`${at} = ${String(node)}`);
		return;
	}
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
export function reach(root, dotted) {
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
export async function load(root, dotted) {
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
export async function build(fixture, at, options) {
	const dir = path.join(FIXTURES, fixture);
	const api = await slothlet({ dir: at === "base" ? dir : BASE, silent: true, ...options });
	if (at === "base") await api.slothlet.api.add("probe", BASE);
	else await api.slothlet.api.add(at, dir);
	return api;
}

/**
 * A path relative to the mount, under the mount's prefix: the top folder's own name is the mount at `<top>` (Rule 13),
 * so `e.helper` is `e.helper` there and `zz.e.helper` at `zz.e`.
 * @param {string} at - `base`, or the mount path.
 * @param {string} top - The case's top folder.
 * @param {string} relative - The path as the base load has it.
 * @returns {string} The path at that placement.
 */
export function placed(at, top, relative) {
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
export function expectedTree(at, top, tree) {
	const entries = tree.map((entry) => placed(at, top, entry));
	const prefix = placed(at, top, top).split(".").slice(0, -1);
	return [...prefix.map((_, index) => prefix.slice(0, index + 1).join(".")), ...entries].sort();
}

/**
 * The function a file exports under `name`, imported plainly (a CommonJS file's `module.exports` is its default).
 * @param {string} fixture - The case's folder name.
 * @param {string} file - The file, relative to the case's folder.
 * @param {string} name - `default`, or a named export.
 * @returns {Promise<Function>} The export.
 */
export async function plain(fixture, file, name) {
	const full = path.join(FIXTURES, fixture, file);
	if (full.endsWith(".cjs")) {
		const exported = createRequire(import.meta.url)(full);
		return name === "default" ? exported : exported[name];
	}
	const namespace = await import(pathToFileURL(full).href);
	return namespace[name];
}

export const ROWS = Object.entries(CASES).flatMap(([fixture, { top, tree, twin = {}, wrong = [] }]) =>
	["base", "zz", "zz.s", top, `zz.${top}`].map((at) => ({
		fixture,
		at,
		top,
		tree,
		twin: Object.entries(twin).map(([relative, [file, name]]) => ({ at: placed(at, top, relative), file, name })),
		leaves: tree.filter((entry) => entry.includes(" -> ")).map((entry) => placed(at, top, entry.split(" -> ")[0])),
		wrong: wrong.map((entry) => placed(at, top, entry))
	}))
);
export const PROMOTED = ROWS.filter((row) => row.twin.length > 0);

/** The configurations every row runs in: [mode, runtime]. */
export const MODES = [
	["eager", "async"],
	["eager", "live"],
	["lazy", "async"],
	["lazy", "live"]
];
