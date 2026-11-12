/**
 * @fileoverview A node's recorded api path is the path it is reached at (#743), for every node of a set of fixtures:
 * loaded as a base folder, and mounted with `api.slothlet.api.add()` under a plain path, a nested path, and paths
 * whose last segment repeats a name inside the folder (Rule 13).
 *
 * @description
 * The recorded path (`node.__metadata.apiPath`) is what permission rules, hooks, ownership and metadata key off. The
 * test walks each tree and compares it with the path walked: the expected value is the walk itself.
 *
 * Fixtures: every folder under `api_tests/smart_flatten/`, plus the base fixtures that hold the folder shapes #743
 * names (same-named folders, multi-default folders, `addapi` files beside a self-named file).
 * @module tests/vitests/suites/smart-flattening/recorded-path-is-placement
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";

const API_TESTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests");
const SMART = path.join(API_TESTS, "smart_flatten");

/** Fixtures that cannot be loaded as they are (they exist to be refused). */
const SKIP = new Set(["api_smart_flatten_bad_module"]);

const FIXTURES = [
	...fs
		.readdirSync(SMART, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !SKIP.has(entry.name))
		.map((entry) => path.join(SMART, entry.name)),
	...[
		"api_test",
		"api_tv_test",
		"api_test_mixed",
		"api_test_cjs",
		"api_test_collections",
		"api_test_folder_dedupe",
		"api_test_same_named_folder"
	].map((name) => path.join(API_TESTS, name))
].map((dir) => ({ name: path.relative(API_TESTS, dir), dir }));

/** Root keys that are slothlet's own or a default routine's cascade, not a fixture's node. */
const OWN_ROOT_KEYS = new Set(["slothlet", "shutdown", "destroy", "initialize"]);

/**
 * Walk a tree and collect every node whose recorded path differs from the path it was reached at.
 * @param {object} root - Where the walk starts.
 * @param {string[]} at - The path of `root`.
 * @param {boolean} lazy - Whether to load each node before reading it.
 * @returns {Promise<{walked: number, drift: Array<[string, string]>}>} How many nodes were read, and the differences.
 */
async function walkTree(root, at, lazy) {
	const drift = [];
	const seen = new Set();
	let walked = 0;
	const walk = async (node, keys, depth) => {
		if (depth > 8 || node === null || (typeof node !== "object" && typeof node !== "function")) return;
		if (lazy) {
			try {
				await node;
			} catch {
				return;
			}
		}
		let meta;
		try {
			meta = node.__metadata;
		} catch {
			return;
		}
		if (keys.length > at.length) {
			if (!meta || typeof meta.apiPath !== "string") return;
			walked++;
			if (meta.apiPath !== keys.join(".")) drift.push([keys.join("."), meta.apiPath]);
		}
		if (seen.has(node)) return;
		seen.add(node);
		for (const key of Object.keys(node)) {
			if (keys.length === 0 && OWN_ROOT_KEYS.has(key)) continue;
			let child;
			try {
				child = node[key];
			} catch {
				// A member whose getter throws (some fixtures have one on purpose) holds no node.
				continue;
			}
			await walk(child, [...keys, key], depth + 1);
		}
	};
	await walk(root, at, 0);
	return { walked, drift };
}

/**
 * The mount paths to try for a fixture: a plain one, a nested one, and for up to three entries at the folder's root
 * the entry's own name alone and as the last segment of a nested path.
 * @param {string} dir - The fixture folder.
 * @returns {string[]} Mount paths.
 */
function mountPathsFor(dir) {
	const names = fs
		.readdirSync(dir, { withFileTypes: true })
		.map((entry) => (entry.isDirectory() ? entry.name : entry.name.replace(/\.[^.]+$/, "")))
		.filter((name) => /^[a-z][a-zA-Z0-9]*$/.test(name));
	return ["mnt", "mnt.sub", ...[...new Set(names)].slice(0, 3).flatMap((name) => [name, `zz.${name}`])];
}

describe.each(["eager", "lazy"])("a node records the path it is reached at (#743) > %s", (mode) => {
	/** Nodes read across the fixtures, so a walk that reads nothing cannot pass. */
	const totals = { walked: 0 };

	it.each(FIXTURES)("$name loaded as a base folder", async ({ dir }) => {
		const api = await slothlet({ dir, mode, silent: true });
		try {
			const { walked, drift } = await walkTree(api, [], mode === "lazy");
			totals.walked += walked;
			expect(drift).toEqual([]);
		} finally {
			await api.slothlet.shutdown();
		}
	});

	it.each(FIXTURES)("$name mounted with api.add", async ({ dir }) => {
		for (const mount of mountPathsFor(dir)) {
			const api = await slothlet({ dir: path.join(API_TESTS, "api_test_globstar_zero", "work"), mode, silent: true });
			try {
				await api.slothlet.api.add(mount, dir);
				const { walked, drift } = await walkTree(api[mount.split(".")[0]], [mount.split(".")[0]], mode === "lazy");
				totals.walked += walked;
				expect([mount, drift]).toEqual([mount, []]);
			} finally {
				await api.slothlet.shutdown();
			}
		}
	});

	it("read the nodes of the fixtures", () => {
		expect(totals.walked).toBeGreaterThan(5000);
	});
});
