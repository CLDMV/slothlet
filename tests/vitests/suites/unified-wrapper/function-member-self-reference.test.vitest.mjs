/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/function-member-self-reference.test.vitest.mjs
 *	@Date: 2026-11-18T07:10:04-08:00 (1795014604)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T07:41:54-08:00 (1795016514)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function member that is the node's own function, or an ancestor's, is that node, as in plain JS.
 *
 * @description
 * A module that puts a reference to its own function on that function (`fn.me = fn`) makes a cycle: in plain JS
 * `fn.me === fn` and `fn.me.me === fn`. The api closes the cycle the same way: `api.x.me` is `api.x`, never a new
 * node, so a walk of the api ends. The same holds for a member that refers further up: with `cyc.inner.up = cyc`,
 * `api.cyc.inner.up` is `api.cyc`.
 *
 * Fixtures: `api_test_collisions/pair/fnsolo` (a callable folder whose function holds `me`) and `pair/fnprop` (the same
 * folder colliding with a file, whose function's members move onto the node the file keeps); `cyc/cyc.mjs` (written to
 * tmp/) puts a function on a function that refers back to the outer one.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLLISIONS = path.resolve(__dirname, "../../../../api_tests/api_test_collisions");
const ROOT = path.join(process.cwd(), "tmp", "function-member-self-reference");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "api", "cyc"), { recursive: true });
	// A sibling keeps the folder a namespace whose self-named file's function is its callable.
	writeFileSync(path.join(ROOT, "api", "cyc", "extra.mjs"), 'export const ping = "extra";\n');
	writeFileSync(
		path.join(ROOT, "api", "cyc", "cyc.mjs"),
		[
			"export default function cyc() {",
			'\treturn "cyc";',
			"}",
			"function inner() {",
			'\treturn "inner";',
			"}",
			"inner.up = cyc;",
			"cyc.inner = inner;",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Load a lazy node and everything below it the way a caller does: by awaiting it.
 * @param {*} node - The node.
 * @returns {Promise<void>}
 */
async function load(node) {
	await node?.___materialize?.();
}

/**
 * Walk the api as plain JS would, each node once, and count the nodes.
 * @param {*} node - Where to start.
 * @param {WeakSet<object>} [seen] - Nodes already walked.
 * @returns {Promise<number>} How many nodes were walked.
 */
async function walk(node, seen = new WeakSet()) {
	if (!node || (typeof node !== "object" && typeof node !== "function") || seen.has(node)) return 0;
	seen.add(node);
	await load(node);
	let count = 1;
	for (const key of Object.keys(node)) count += await walk(node[key], seen);
	return count;
}

describe.each(["eager", "lazy"])("a function member that refers to its own node is that node > %s", (mode) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(["fnsolo", "fnprop"])("%s: `me` is the node itself, read after the node has loaded", async (name) => {
		api = await slothlet({ mode, silent: true, base: COLLISIONS });
		await api.pair[name];
		const node = api.pair[name];
		expect(node.me).toBe(node);
		expect(node.me.me).toBe(node);
		expect(api.pair[name].me).toBe(api.pair[name]);
		expect(node.me()).toBe(node());
	});

	it.each(["fnsolo", "fnprop"])("%s: `me` read before the node has loaded resolves as the node does", async (name) => {
		api = await slothlet({ mode, silent: true, base: COLLISIONS });
		const [me, node] = await Promise.all([api.pair[name].me, api.pair[name]]);
		expect(me).toBe(node);
		expect(api.pair[name].me).toBe(api.pair[name]);
		expect(api.pair[name].me.me).toBe(api.pair[name]);
	});

	it("an ancestor's function on a descendant is the ancestor's node, read after loading", async () => {
		api = await slothlet({ mode, silent: true, base: path.join(ROOT, "api") });
		await api.cyc;
		const inner = api.cyc.inner;
		expect(inner.up).toBe(api.cyc);
		expect(inner.up.inner).toBe(inner);
		expect(api.cyc.inner.up.inner.up).toBe(api.cyc);
		expect(inner.up()).toBe("cyc");
	});

	it("an ancestor's function on a descendant is the ancestor's node, read before loading", async () => {
		api = await slothlet({ mode, silent: true, base: path.join(ROOT, "api") });
		const [up, node] = await Promise.all([api.cyc.inner.up, api.cyc]);
		expect(typeof up).toBe("function");
		expect(up()).toBe("cyc");
		expect(node()).toBe("cyc");
		expect(api.cyc.inner.up).toBe(api.cyc);
	});

	it("a walk of the api that visits each node once ends", async () => {
		api = await slothlet({ mode, silent: true, base: COLLISIONS });
		const count = await walk(api.pair);
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThan(1000);
	});
});
