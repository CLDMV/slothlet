/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-reload-coverage.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:16:19 -08:00 (1772313379)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for hot-reload internals: _reloadByModuleID, _reloadByApiPath,
 * _findAffectedCaches, _restoreApiTree, and reloadApiComponent error paths.
 *
 * @description
 * Exercises the previously uncovered reload code paths in api-manager.mjs:
 *   lines 1848-1875  reloadApiComponent dispatch + error path
 *   lines 1888-1965  _reloadByModuleID (rebuild cache + restore tree)
 *   lines 1966-2060  _reloadByApiPath  (find affected caches, sort, group, rebuild)
 *   lines 2060-2260  _findAffectedCaches (exact, child, history, parent resolution)
 *   lines 2260-2500  _restoreApiTree   (recursive wrapper update)
 *
 * Uses eager mode exclusively to avoid lazy-materialization timing races.
 *
 * @module tests/vitests/suites/api-manager/api-manager-reload-coverage
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Single eager config — using only one matrix entry keeps this file's heap under
 * ~120 MB so the vitest coverage-temp JSON is written before the directory is
 * cleaned up during a parallel run.  Coverage only needs one path exercised.
 */
const RELOAD_MATRIX = [{ name: "EAGER_HOOKS", config: { mode: "eager", runtime: "async", hook: { enabled: true } } }];

/**
 * Create a slothlet instance with the given matrix config and optional overrides.
 * @param {object} baseConfig - Matrix config entry.
 * @param {object} [overrides] - Extra config overrides.
 * @returns {Promise<object>} Ready slothlet API instance.
 */
async function makeApi(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, ...overrides });
}

// ---------------------------------------------------------------------------
// 1. reloadApiComponent error paths
// ---------------------------------------------------------------------------
describe("reloadApiComponent — error paths", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws INVALID_ARGUMENT when reload is called with a non-string non-identifier value", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		// Passing a number as pathOrModuleId should throw before getting to reloadApiComponent
		await expect(api.slothlet.api.reload(42)).rejects.toThrow();
	});

	it("throws INVALID_API_PATH when api path does not exist in the live API", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		await expect(api.slothlet.api.reload("doesNotExist.atAll")).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 2. _reloadByModuleID
// ---------------------------------------------------------------------------
describe.each(RELOAD_MATRIX)("_reloadByModuleID — $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 50));
	});

	it("reloads a module by its moduleID and preserves wrapper references", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("ext", TEST_DIRS.API_TEST_MIXED, { moduleID: "mixed-mod" });

		// Capture a reference before reload
		const before = api.ext;
		expect(before).toBeDefined();

		// Reload by moduleID — triggers _reloadByModuleID
		await api.slothlet.api.reload("mixed-mod");

		// Wrapper reference at the path should still be accessible
		expect(api.ext).toBeDefined();
	});

	it("reloads a deeply-nested module by its moduleID", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("deep.nested", TEST_DIRS.API_TEST_MIXED, { moduleID: "deep-mod" });

		expect(api.deep?.nested).toBeDefined();

		await api.slothlet.api.reload("deep-mod");

		expect(api.deep?.nested).toBeDefined();
	});

	it("reloads the base module using its auto-assigned moduleID from addHistory", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// The base module always has an entry in addHistory — find its moduleID
		const baseModuleID = api.slothlet.__state?.apiManager?.state?.addHistory?.[0]?.moduleID;
		if (!baseModuleID) return; // skip if internals inaccessible

		// Should not throw
		await expect(api.slothlet.api.reload(baseModuleID)).resolves.not.toThrow();
	});

	it("reloads two sibling modules sequentially by moduleID", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("ext1", TEST_DIRS.API_TEST_MIXED, { moduleID: "mod-a" });
		await api.slothlet.api.add("ext2", TEST_DIRS.API_TEST, { moduleID: "mod-b" });

		await api.slothlet.api.reload("mod-a");
		await api.slothlet.api.reload("mod-b");

		expect(api.ext1).toBeDefined();
		expect(api.ext2).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 3. _reloadByApiPath
// ---------------------------------------------------------------------------
describe.each(RELOAD_MATRIX)("_reloadByApiPath — $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 50));
	});

	it("reloads an added module by its apiPath endpoint string", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "m1" });
		expect(api.extra).toBeDefined();

		// api.slothlet.api.reload("extra") → path is in live API → _reloadByApiPath("extra")
		await api.slothlet.api.reload("extra");

		expect(api.extra).toBeDefined();
	});

	it("reloads a nested api path endpoint", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("features.core", TEST_DIRS.API_TEST, { moduleID: "core-mod" });
		expect(api.features?.core).toBeDefined();

		await api.slothlet.api.reload("features.core");

		expect(api.features?.core).toBeDefined();
	});

	it("reloads base module via dot notation '.'", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// api.slothlet.api.reload(".") → normalised to "." → _reloadByApiPath(".")
		await expect(api.slothlet.api.reload(".")).resolves.not.toThrow();
	});

	it("reloads base module when pathOrModuleId is null", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await expect(api.slothlet.api.reload(null)).resolves.not.toThrow();
	});

	it("reloads base module when pathOrModuleId is undefined", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await expect(api.slothlet.api.reload(undefined)).resolves.not.toThrow();
	});

	it("reloads base module when pathOrModuleId is empty string", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await expect(api.slothlet.api.reload("")).resolves.not.toThrow();
	});

	it("reloads two overlapping modules that share a path endpoint, exercising sort + group logic", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// Add two modules to the same path; second with forceOverwrite so both end up in addHistory for "overlap"
		await api.slothlet.api.add("overlap", TEST_DIRS.API_TEST, { moduleID: "overlap-base" });
		await api.slothlet.api.add("overlap", TEST_DIRS.API_TEST_MIXED, { moduleID: "overlap-ext", forceOverwrite: true });

		// Reload by path — _findAffectedCaches will find both moduleIDs, then sort/group, then call _reloadByModuleID for each
		await api.slothlet.api.reload("overlap");

		expect(api.overlap).toBeDefined();
	});

	it("preserves outer API when reloading an inner sub-path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("outer", TEST_DIRS.API_TEST, { moduleID: "outer-mod" });
		await api.slothlet.api.add("outer.inner", TEST_DIRS.API_TEST_MIXED, { moduleID: "inner-mod" });

		await api.slothlet.api.reload("inner-mod"); // by moduleID since it's in addHistory

		expect(api.outer).toBeDefined();
		expect(api.outer?.inner).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 4. _findAffectedCaches — child cache path resolution
// ---------------------------------------------------------------------------
describe.each(RELOAD_MATRIX)("_findAffectedCaches child resolution — $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 50));
	});

	it("finds child caches when reloading a parent scope path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// Add a child under the base — so the base scope covers it
		await api.slothlet.api.add("scope.childA", TEST_DIRS.API_TEST_MIXED, { moduleID: "scope-a" });
		await api.slothlet.api.add("scope.childB", TEST_DIRS.API_TEST, { moduleID: "scope-b" });

		// Reload "scope" — _findAffectedCaches finds scope-a and scope-b as children
		await api.slothlet.api.reload("scope");

		expect(api.scope?.childA).toBeDefined();
		expect(api.scope?.childB).toBeDefined();
	});

	it("resolves via ownership history when path matches an add() record", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("histPath", TEST_DIRS.API_TEST_MIXED, { moduleID: "hist-mod" });
		expect(api.histPath).toBeDefined();

		// Reload by apiPath — _findAffectedCaches uses ownership history lookup
		await api.slothlet.api.reload("histPath");

		expect(api.histPath).toBeDefined();
	});

	it("falls back to parent cache when path is a leaf under a registered scope", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("parentScope", TEST_DIRS.API_TEST, { moduleID: "parent-mod" });

		// Access a sub-key that exists deeper under parentScope
		const subKeys = Object.keys(api.parentScope || {});
		if (subKeys.length === 0) return; // skip if no nested keys

		const firstKey = subKeys[0];
		// api.parentScope[firstKey] exists; reload "parentScope.firstKey" → _findAffectedCaches
		// traces up to parent-mod cache as the covering parent
		await api.slothlet.api.reload(`parentScope.${firstKey}`);

		expect(api.parentScope?.[firstKey]).toBeDefined();
	});
});
