/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/ownership/ownership-remove-rollback.test.vitest.mjs
 *	@Date: 2026-11-17T07:36:42-08:00 (1794929802)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:10-08:00 (1795869130)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Removals at a shared path keep the api and the rollback state in step: remove(apiPath) takes the subtree
 * at the path and never an unrelated module, a scoped remove of the replacing module puts back what its replace hid
 * exactly as removing the module does, and a member removed while hidden stays removed when the replacing module goes.
 * @module tests/vitests/suites/ownership/ownership-remove-rollback
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

const CONFIGS = [
	{ name: "EAGER", config: { mode: "eager", runtime: "async" } },
	{ name: "EAGER_LIVE", config: { mode: "eager", runtime: "live" } },
	{ name: "LAZY", config: { mode: "lazy", runtime: "async" } },
	{ name: "LAZY_LIVE", config: { mode: "lazy", runtime: "live" } }
];

let tempBase;
let baseDir;
let aDir;
let bDir;
let cDir;
let leavesDir;
let zDir;
let nsDir;

beforeAll(() => {
	tempBase = makeTestTmpDirSync("ownership-remove-rollback");
	baseDir = join(tempBase, "base");
	aDir = join(tempBase, "A");
	bDir = join(tempBase, "B");
	cDir = join(tempBase, "C");
	leavesDir = join(tempBase, "leaves");
	zDir = join(tempBase, "Z");
	nsDir = join(tempBase, "ns");
	for (const dir of [baseDir, aDir, bDir, cDir, leavesDir, zDir, join(nsDir, "ns")]) mkdirSync(dir, { recursive: true });
	writeFileSync(join(baseDir, "ping.mjs"), "export function ping() { return 1; }");
	writeFileSync(join(aDir, "shared.mjs"), 'export function who() { return "a"; }\nexport function extra() { return "extra-a"; }');
	writeFileSync(join(bDir, "shared.mjs"), 'export function who() { return "b"; }');
	writeFileSync(join(cDir, "cmod.mjs"), 'export function cfn() { return "c"; }');
	writeFileSync(join(leavesDir, "alpha.mjs"), 'export function alpha() { return "alpha"; }');
	writeFileSync(join(leavesDir, "beta.mjs"), 'export function beta() { return "beta"; }');
	writeFileSync(join(zDir, "zed.mjs"), 'export function zed() { return "z"; }');
	writeFileSync(join(nsDir, "ns", "x.mjs"), 'export function x() { return "x"; }');
	writeFileSync(join(nsDir, "ns", "y.mjs"), 'export function y() { return "y"; }');
});

afterAll(() => {
	rmSync(tempBase, { recursive: true, force: true });
});

/**
 * Create an instance with the base folder, permissions on, and the given collision mode for api.add.
 * @param {object} config - Matrix config.
 * @param {string} [collision="merge"] - Collision mode for api.add.
 * @returns {Promise<{api: object, handlers: object, owner: function(string): (string|null)}>} The api, its handlers, and an owner lookup.
 */
async function make(config, collision = "merge") {
	const api = await slothlet({
		...config,
		base: baseDir,
		permissions: { mode: "on" },
		api: { collision: { mode: { api: collision } } }
	});
	const handlers = resolveWrapper(api.ping).____slothlet.handlers;
	const owner = (path) => handlers.ownership.getCurrentOwner(path)?.moduleID ?? null;
	return { api, handlers, owner };
}

for (const { name, config } of CONFIGS) {
	describe(`remove and rollback at a shared path (${name})`, () => {
		it("remove(apiPath) removes the subtree at the path, not a loaded module that owns nothing", async () => {
			const { api, handlers } = await make(config);
			try {
				const idA = await api.slothlet.api.add("q", leavesDir);
				expect(idA.startsWith("q_")).toBe(true);
				expect(await api.slothlet.api.remove("q.alpha", idA)).toBe(true);
				expect(await api.slothlet.api.remove("q.beta", idA)).toBe(true);
				expect(api.q).toBeUndefined();
				expect(handlers.apiCacheManager.has(idA)).toBe(true);

				await api.slothlet.api.add("q", zDir, { id: "z" });
				expect(api.q.zed()).toBe("z");

				expect(await api.slothlet.api.remove("q")).toBe(true);
				expect(api.q).toBeUndefined();
				expect(handlers.apiCacheManager.has(idA)).toBe(true);
				expect(await api.slothlet.api.remove(idA)).toBe(true);
				expect(handlers.apiCacheManager.has(idA)).toBe(false);
			} finally {
				await api.shutdown();
			}
		});

		for (const scope of ["p", "p.shared"]) {
			it(`a scoped remove of B's share at "${scope}" puts back what B's replace hid, as remove("b") does`, async () => {
				const { api, owner } = await make(config, "replace");
				try {
					await api.slothlet.api.add("p", aDir, { id: "a" });
					await api.slothlet.api.add("p", bDir, { id: "b" });
					expect(Object.keys(api.p.shared)).toEqual(["who"]);
					expect(api.p.shared.who()).toBe("b");
					expect(owner("p.shared.extra")).toBeNull();

					expect(await api.slothlet.api.remove(scope, "b")).toBe(true);
					expect(Object.keys(api.p.shared).sort()).toEqual(["extra", "who"]);
					expect(api.p.shared.who()).toBe("a");
					expect(api.p.shared.extra()).toBe("extra-a");
					expect(owner("p.shared.who")).toBe("a");
					expect(owner("p.shared.extra")).toBe("a");
				} finally {
					await api.shutdown();
				}
			});
		}

		it('remove("b") puts back what B\'s replace hid (reference for the scoped form)', async () => {
			const { api, owner } = await make(config, "replace");
			try {
				await api.slothlet.api.add("p", aDir, { id: "a" });
				await api.slothlet.api.add("p", bDir, { id: "b" });
				void Object.keys(api.p.shared);
				expect(await api.slothlet.api.remove("b")).toBe(true);
				expect(Object.keys(api.p.shared).sort()).toEqual(["extra", "who"]);
				expect(api.p.shared.extra()).toBe("extra-a");
				expect(owner("p.shared.extra")).toBe("a");
			} finally {
				await api.shutdown();
			}
		});

		it("a module removed while a replace hid it stays removed when the replacing module is removed", async () => {
			const { api, owner } = await make(config, "replace");
			try {
				await api.slothlet.api.add("p", aDir, { id: "a" });
				await api.slothlet.api.add("p.shared.c", cDir, { id: "c" });
				expect(api.p.shared.c.cmod.cfn()).toBe("c");
				await api.slothlet.api.add("p", bDir, { id: "b" });
				expect(Object.keys(api.p.shared)).toEqual(["who"]);

				expect(await api.slothlet.api.remove("c")).toBe(true);
				expect(await api.slothlet.api.remove("b")).toBe(true);
				expect(Object.keys(api.p.shared).sort()).toEqual(["extra", "who"]);
				expect(api.p.shared.c).toBeUndefined();
				expect(owner("p.shared.c")).toBeNull();
				expect(api.p.shared.who()).toBe("a");
			} finally {
				await api.shutdown();
			}
		});

		it("a scoped remove of a member inside a namespace that has not been read yet removes it", async () => {
			const { api, owner } = await make(config);
			try {
				await api.slothlet.api.add("q", nsDir, { id: "n" });
				expect(await api.slothlet.api.remove("q.ns.x", "n")).toBe(true);
				expect(Object.keys(api.q.ns)).toEqual(["y"]);
				expect(api.q.ns.x).toBeUndefined();
				expect(api.q.ns.y()).toBe("y");
				expect(owner("q.ns.x")).toBeNull();
			} finally {
				await api.shutdown();
			}
		});
	});
}
