/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/isolation/helper-imports-per-instance.test.vitest.mjs
 *	@Date: 2026-09-28T20:29:53-07:00 (1790652593)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:33-07:00 (1791091713)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Relative helper imports below a leaf are per instance (#518).
 *
 * @description
 * Each slothlet instance loads its own copy of every leaf. The modules a leaf IMPORTS — a relative
 * or `file:` helper, at any depth and in any format — must follow the leaf's instance: one copy per
 * instance, so module-level state in a helper never leaks between two instances. Within ONE instance
 * a helper imported by several leaves — any format, base or `api.add` mount — stays a single copy,
 * and a partial reload (`api.slothlet.api.reload(…)`) keeps that copy; only a full reload
 * (`api.slothlet.reload()`) gives the instance a fresh one.
 *
 * Bare specifiers stay shared: a `node_modules` package, a `node:` builtin, and slothlet's own
 * runtime (which must remain the single live-binding runtime) are never duplicated per instance.
 */

import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_HELPER_IMPORTS;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const NATIVE_PROBE = path.resolve(BASE, "../native-probe.mjs");
const MOUNT = path.resolve(BASE, "../mount");

const CONFIGS = [
	{ name: "eager", config: { mode: "eager" } },
	{ name: "lazy", config: { mode: "lazy" } },
	{ name: "eager + typescript", config: { mode: "eager", typescript: true } },
	{ name: "lazy + typescript", config: { mode: "lazy", typescript: true } }
];

describe.each(CONFIGS)("Isolation > helper imports per instance (#518) > '$name'", ({ config }) => {
	const instances = [];

	/**
	 * Create an instance over the helper-imports fixture and track it for shutdown.
	 * @returns {Promise<object>} The composed api.
	 */
	const create = async () => {
		const api = await slothlet({ ...config, base: BASE, silent: true });
		instances.push(api);
		return api;
	};

	afterEach(async () => {
		while (instances.length) await instances.pop().shutdown();
	});

	it("gives each instance its own copy of an ESM leaf's relative helper", async () => {
		const a = await create();
		const b = await create();
		expect(await a.tally.count()).toBe(1);
		expect(await a.tally.count()).toBe(2);
		expect(await b.tally.count()).toBe(1);
	});

	it("isolates a two-level helper chain below the leaf", async () => {
		const a = await create();
		const b = await create();
		expect(await a.tally.chain()).toBe(1);
		expect(await a.tally.chain()).toBe(2);
		expect(await b.tally.chain()).toBe(1);
	});

	it("isolates a helper nested inside the api folder", async () => {
		const a = await create();
		const b = await create();
		expect(await a.tally.nested()).toBe(1);
		expect(await a.tally.nested()).toBe(2);
		expect(await b.tally.nested()).toBe(1);
	});

	it("keeps ONE helper copy shared by every leaf of the same instance", async () => {
		const a = await create();
		const b = await create();
		expect(await a.tally.count()).toBe(1);
		expect(await a.peer.count()).toBe(2);
		expect(await b.peer.count()).toBe(1);
		expect(await b.tally.count()).toBe(2);
	});

	it("gives each instance its own copy of a .cjs leaf's relatively required helpers", async () => {
		const a = await create();
		const b = await create();
		expect(await a.cjsleaf.count()).toBe(1);
		expect(await a.cjsleaf.count()).toBe(2);
		expect(await b.cjsleaf.count()).toBe(1);
		// Second-level require below the helper.
		expect(await a.cjsleaf.inner()).toBe(1);
		expect(await a.cjsleaf.inner()).toBe(2);
		expect(await b.cjsleaf.inner()).toBe(1);
	});

	it("keeps ONE required helper copy shared by every .cjs leaf of the same instance", async () => {
		const a = await create();
		const b = await create();
		expect(await a.cjsleaf.count()).toBe(1);
		expect(await a.cjspeer.count()).toBe(2);
		expect(await b.cjspeer.count()).toBe(1);
	});

	it("keeps bare packages, node builtins and slothlet's runtime shared across instances", async () => {
		const a = await create();
		const b = await create();
		const refsA = await a.shared.refs();
		const refsB = await b.shared.refs();
		expect(refsA.runtime).toBe(refsB.runtime);
		expect(refsA.EventEmitter).toBe(refsB.EventEmitter);
		expect(refsA.Parser).toBe(refsB.Parser);
		// The single live-binding runtime still serves each instance its own api.
		expect(await a.shared.viaSelf()).toBe(1);
		expect(await a.shared.viaSelf()).toBe(2);
		expect(await b.shared.viaSelf()).toBe(1);
	});

	it("shares one helper copy between a base leaf and an api.add leaf of the same instance", async () => {
		const a = await create();
		const b = await create();
		await a.slothlet.api.add("plugins", MOUNT);
		await b.slothlet.api.add("plugins", MOUNT);
		expect(await a.tally.count()).toBe(1);
		expect(await a.plugins.extra.count()).toBe(2);
		expect(await a.peer.count()).toBe(3);
		expect(await b.plugins.extra.count()).toBe(1);
		expect(await a.cjsleaf.count()).toBe(1);
		expect(await a.plugins.cjsextra.count()).toBe(2);
		expect(await b.plugins.cjsextra.count()).toBe(1);
	});

	it("keeps base and api.add leaves on one fresh helper copy after an instance reload", async () => {
		const a = await create();
		await a.slothlet.api.add("plugins", MOUNT);
		expect(await a.tally.count()).toBe(1);
		expect(await a.plugins.extra.count()).toBe(2);
		expect(await a.cjsleaf.count()).toBe(1);
		expect(await a.plugins.cjsextra.count()).toBe(2);
		await a.slothlet.reload();
		expect(await a.tally.count()).toBe(1);
		expect(await a.plugins.extra.count()).toBe(2);
		expect(await a.cjsleaf.count()).toBe(1);
		expect(await a.plugins.cjsextra.count()).toBe(2);
	});

	it("refreshes relative helpers on a full reload", async () => {
		const a = await create();
		expect(await a.tally.count()).toBe(1);
		expect(await a.tally.count()).toBe(2);
		expect(await a.tally.chain()).toBe(1);
		expect(await a.cjsleaf.count()).toBe(1);
		await a.slothlet.reload();
		expect(await a.tally.count()).toBe(1);
		expect(await a.tally.chain()).toBe(1);
		expect(await a.cjsleaf.count()).toBe(1);
		// Reloaded leaves of the instance still share one helper copy.
		expect(await a.peer.count()).toBe(2);
	});

	it("keeps the instance's helper copy across a base api reload", async () => {
		const a = await create();
		expect(await a.tally.count()).toBe(1);
		expect(await a.cjsleaf.count()).toBe(1);
		await a.slothlet.api.reload();
		expect(await a.tally.count()).toBe(2);
		expect(await a.peer.count()).toBe(3);
		expect(await a.cjsleaf.count()).toBe(2);
		expect(await a.cjspeer.count()).toBe(3);
	});

	it("keeps the instance's helper copy across a scoped reload", async () => {
		const a = await create();
		const b = await create();
		expect(await a.tally.count()).toBe(1);
		expect(await a.tally.count()).toBe(2);
		expect(await b.tally.count()).toBe(1);
		await a.slothlet.api.reload("tally");
		expect(await a.tally.count()).toBe(3);
		expect(await a.peer.count()).toBe(4);
		// The other instance is untouched by a's reload.
		expect(await b.tally.count()).toBe(2);
	});

	it("keeps base and reloaded api.add leaves on one helper copy after a mount reload", async () => {
		const a = await create();
		const b = await create();
		await a.slothlet.api.add("plugins", MOUNT);
		await b.slothlet.api.add("plugins", MOUNT);
		expect(await a.tally.count()).toBe(1);
		expect(await a.plugins.extra.count()).toBe(2);
		expect(await a.cjsleaf.count()).toBe(1);
		expect(await a.plugins.cjsextra.count()).toBe(2);
		await a.slothlet.api.reload("plugins");
		expect(await a.plugins.extra.count()).toBe(3);
		expect(await a.tally.count()).toBe(4);
		expect(await a.plugins.cjsextra.count()).toBe(3);
		expect(await a.cjsleaf.count()).toBe(4);
		expect(await b.plugins.extra.count()).toBe(1);
		expect(await b.plugins.cjsextra.count()).toBe(1);
	});

	if (config.typescript) {
		it("gives each instance its own copy of a .ts leaf's .ts and .mjs helpers", async () => {
			const a = await create();
			const b = await create();
			expect(await a.tsleaf.tsCount()).toBe(1);
			expect(await a.tsleaf.tsCount()).toBe(2);
			expect(await b.tsleaf.tsCount()).toBe(1);
			expect(await a.tsleaf.count()).toBe(1);
			expect(await b.tsleaf.count()).toBe(1);
		});

		it("shares one .mjs helper copy between .ts and .mjs leaves of the same instance", async () => {
			const a = await create();
			expect(await a.tally.count()).toBe(1);
			expect(await a.tsleaf.count()).toBe(2);
			expect(await a.peer.count()).toBe(3);
		});

		it("keeps a .ts leaf's helpers across a partial reload and refreshes them on a full reload", async () => {
			const a = await create();
			expect(await a.tsleaf.tsCount()).toBe(1);
			expect(await a.tsleaf.tsCount()).toBe(2);
			expect(await a.tsleaf.count()).toBe(1);
			await a.slothlet.api.reload("tsleaf");
			expect(await a.tsleaf.tsCount()).toBe(3);
			expect(await a.tsleaf.count()).toBe(2);
			await a.slothlet.reload();
			expect(await a.tsleaf.tsCount()).toBe(1);
			expect(await a.tsleaf.count()).toBe(1);
		});
	}
});

// Inside vitest the leaves load through vite's module graph (covered above, via the config's
// slothletInstanceImports plugin). A real Node process exercises the other path: Node's own resolver
// with slothlet's registered resolve hook, and require() for the .cjs leaves.
describe("Isolation > helper imports per instance (#518) > native Node resolver", () => {
	it("isolates every helper format per instance, keeps helpers across partial reloads, refreshes them on a full reload, and keeps bare imports shared", () => {
		const result = spawnSync(process.execPath, [NATIVE_PROBE], { cwd: REPO_ROOT, env: process.env, encoding: "utf8", timeout: 120000 });
		expect(result.status, result.stderr).toBe(0);
		const out = JSON.parse(result.stdout.trim().split("\n").pop());
		const expected = {
			// a, a, b — each instance counts from 1.
			esm: [1, 2, 1],
			chain: [1, 2, 1],
			nested: [1, 1],
			// peer shares tally's helper copy within each instance.
			peer: [3, 2],
			// cjsleaf a, cjspeer a (same copy), cjsleaf b, then the second-level helper for a and b.
			cjs: [1, 2, 1, 1, 1],
			// .ts helper a, a, b; then the .mjs helper shared with tally/peer (a: 4th bump, b: 3rd).
			ts: [1, 2, 1, 4, 3],
			sharedRefs: true,
			viaSelf: [5, 4],
			// api.add leaves continue the base leaves' helper copies: .mjs (a: 6th, b: 5th) and .cjs
			// (a: 3rd after cjsleaf + cjspeer, b: 2nd).
			mount: [6, 5, 3, 2],
			// After a's full reload (api.slothlet.reload()): tally, chain, cjs and .ts helpers restart;
			// b is untouched.
			afterFullReload: [1, 1, 1, 1, 6],
			// After b's scoped reload of tally: b keeps its helper copy (tally 7th bump, chain 2nd);
			// a is untouched.
			afterScopedReload: [7, 2, 2],
			// After b's reload of the plugins mount: the reloaded mount leaves and the base leaves still
			// share b's .mjs and .cjs helper copies.
			afterMountReload: [8, 9, 3, 4]
		};
		expect(out.eager).toEqual(expected);
		expect(out.lazy).toEqual(expected);
	}, 150000);
});
