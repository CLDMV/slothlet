/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/isolation/helper-imports-mixed-formats.test.vitest.mjs
 *	@Date: 2026-10-02 12:27:51 -07:00 (1790969271)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:20 -07:00 (1791083060)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Helpers that cross module systems are per instance too (#534).
 *
 * @description
 * #518 made a leaf's relative helpers one copy per instance. Two combinations cross into a loader
 * cache keyed by file path alone, and so were still shared by every instance:
 *
 * 1. an ESM leaf that `import`s a relative `.cjs` helper — Node caches CommonJS by filename and
 *    ignores the instance query;
 * 2. a `.cjs` leaf that `require()`s an ES module — `require(esm)` loads the module under its plain
 *    file URL.
 *
 * Both now follow the #518 rule: one copy per instance, kept across a partial reload, fresh after a
 * full reload. The `.cjs` helper keeps Node's import shape (`default` is `module.exports`, plus named
 * exports), and `require()` of an ES module keeps Node's (`__esModule` facade for a default export).
 */

import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURE = path.resolve(TEST_DIRS.API_TEST_HELPER_IMPORTS, "../__mixed");
const BASE = path.join(FIXTURE, "api");
const NATIVE_PROBE = path.join(FIXTURE, "native-probe.mjs");
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const CONFIGS = [
	{ name: "eager", config: { mode: "eager" } },
	{ name: "lazy", config: { mode: "lazy" } }
];

describe.each(CONFIGS)("Isolation > helper imports across module systems (#534) > '$name'", ({ config }) => {
	const instances = [];

	/**
	 * Create an instance over the mixed-format fixture and track it for shutdown.
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

	it("gives each instance its own copy of an ESM leaf's .cjs helper, through named and default imports", async () => {
		const a = await create();
		const b = await create();
		expect(await a.esmcjs.count()).toBe(1);
		expect(await a.esmcjs.count()).toBe(2);
		expect(await b.esmcjs.count()).toBe(1);
		expect(await a.esmcjs.viaDefault()).toBe(3);
		expect(await b.esmcjs.viaDefault()).toBe(2);
	});

	it("isolates the .cjs helper's own CommonJS and ES module requires", async () => {
		const a = await create();
		const b = await create();
		expect(await a.esmcjs.inner()).toBe(1);
		expect(await a.esmcjs.inner()).toBe(2);
		expect(await b.esmcjs.inner()).toBe(1);
		expect(await a.esmcjs.deep()).toBe(1);
		expect(await a.esmcjs.deep()).toBe(2);
		expect(await b.esmcjs.deep()).toBe(1);
	});

	it("keeps Node's import shape for a module.exports object literal", async () => {
		const a = await create();
		const b = await create();
		expect(await a.esmcjs.object()).toBe(1);
		expect(await a.esmcjs.object()).toBe(2);
		expect(await b.esmcjs.object()).toBe(1);
		expect(await a.esmcjs.shape()).toEqual({ defaultIsExports: true, label: "object" });
	});

	it("keeps ONE .cjs helper copy shared by every ESM leaf of the same instance", async () => {
		const a = await create();
		const b = await create();
		expect(await a.esmcjs.count()).toBe(1);
		expect(await a.esmcjspeer.count()).toBe(2);
		expect(await b.esmcjspeer.count()).toBe(1);
	});

	it("gives each instance its own copy of a .cjs leaf's required ES modules", async () => {
		const a = await create();
		const b = await create();
		expect(await a.cjsesm.count()).toBe(1);
		expect(await a.cjsesm.count()).toBe(2);
		expect(await b.cjsesm.count()).toBe(1);
		// The required module's own import chain.
		expect(await a.cjsesm.chain()).toBe(1);
		expect(await b.cjsesm.chain()).toBe(1);
		// A `.js` file in a `"type": "module"` scope.
		expect(await a.cjsesm.plain()).toBe(1);
		expect(await a.cjsesm.plain()).toBe(2);
		expect(await b.cjsesm.plain()).toBe(1);
	});

	it("keeps Node's require(esm) shape for an ES module with a default export", async () => {
		const a = await create();
		expect(await a.cjsesm.interop()).toEqual({ esModule: true, defaultType: "function" });
	});

	it("refreshes cross-format helpers on a full reload and leaves the other instance alone", async () => {
		const a = await create();
		const b = await create();
		expect(await a.esmcjs.count()).toBe(1);
		expect(await a.esmcjs.deep()).toBe(1);
		expect(await a.cjsesm.count()).toBe(1);
		expect(await a.cjsesm.plain()).toBe(1);
		expect(await b.esmcjs.count()).toBe(1);
		await a.slothlet.reload();
		expect(await a.esmcjs.count()).toBe(1);
		expect(await a.esmcjs.deep()).toBe(1);
		expect(await a.cjsesm.count()).toBe(1);
		expect(await a.cjsesm.plain()).toBe(1);
		expect(await b.esmcjs.count()).toBe(2);
	});

	it("keeps the instance's cross-format helper copies across a partial reload", async () => {
		const a = await create();
		const b = await create();
		expect(await a.esmcjs.count()).toBe(1);
		expect(await a.esmcjs.deep()).toBe(1);
		expect(await a.cjsesm.count()).toBe(1);
		expect(await a.cjsesm.plain()).toBe(1);
		await a.slothlet.api.reload("esmcjs");
		await a.slothlet.api.reload("cjsesm");
		expect(await a.esmcjs.count()).toBe(2);
		expect(await a.esmcjspeer.count()).toBe(3);
		expect(await a.esmcjs.deep()).toBe(2);
		expect(await a.cjsesm.count()).toBe(2);
		expect(await a.cjsesm.plain()).toBe(2);
		expect(await b.esmcjs.count()).toBe(1);
		expect(await b.cjsesm.count()).toBe(1);
	});
});

// Inside vitest an ESM leaf loads through vite's module graph, while a .cjs leaf and everything it
// require()s load natively. A real Node process runs every leaf through Node's own loaders and
// slothlet's module hooks — including one copy per instance ACROSS module systems.
describe("Isolation > helper imports across module systems (#534) > native Node loaders", () => {
	it("isolates ESM→.cjs and .cjs→ESM helpers per instance, shares them across formats within an instance, keeps them across partial reloads and refreshes them on a full reload", () => {
		const result = spawnSync(process.execPath, [NATIVE_PROBE], { cwd: REPO_ROOT, env: process.env, encoding: "utf8", timeout: 120000 });
		expect(result.status, result.stderr).toBe(0);
		const out = JSON.parse(result.stdout.trim().split("\n").pop());
		const expected = {
			// a, a, b through the named import; then the default import (module.exports) for a and b.
			esmToCjs: [1, 2, 1, 3, 2],
			// The .cjs helper's own require of a .cjs (a, a, b) and of an ES module (a, a, b).
			esmToCjsChain: [1, 2, 1, 1, 2, 1],
			esmToCjsObject: [1, 2, 1],
			esmToCjsShape: { defaultIsExports: true, label: "object" },
			// A second ESM leaf shares the .cjs helper copy within each instance (a: 4th bump, b: 3rd).
			esmToCjsPeer: [4, 3],
			// .cjs leaf → .mjs helper (a, a, b), its import chain (a, b), a `.js` ES module (a, a, b).
			cjsToEsm: [1, 2, 1, 1, 1, 1, 2, 1],
			cjsToEsmInterop: { esModule: true, defaultType: "function" },
			// One copy per instance across module systems: the ESM leaf continues the .mjs helper the .cjs
			// leaf required (a: 3rd, b: 2nd); the .cjs leaf continues the .cjs helper the ESM leaves
			// imported (a: 5th, b: 4th).
			crossFormat: [3, 2, 5, 4],
			// After a's full reload every helper restarts; b is untouched (5th bump).
			afterFullReload: [1, 1, 1, 1, 1, 5],
			// After b's partial reloads b keeps its helper copies; a is untouched.
			afterPartialReload: [6, 2, 3, 2, 2]
		};
		expect(out.eager).toEqual(expected);
		expect(out.lazy).toEqual(expected);
	}, 150000);
});
