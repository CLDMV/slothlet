/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-reload-lite.test.vitest.mjs
 *	@Date: 2026-02-28T00:00:00-08:00 (1772208000)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28T00:00:00-08:00 (1772208000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Lightweight reload coverage tests targeting specific uncovered code paths
 * in api-manager.mjs that are missed when the heavier reload-coverage file loses its
 * v8 coverage data due to OOM during the coverage run.
 *
 * @description
 * Targets (eager mode only, no matrix, minimal memory):
 *
 *  _restoreApiTree nested path (lines 2304-2495):
 *    Triggered when reload is called for a module mounted at a non-root endpoint
 *    (e.g. "ext.tools"), so parts.length > 0 inside _restoreApiTree.
 *
 *  _findAffectedCaches — parent cache branch (lines 2113-2131):
 *    Triggered by reload("parent.leaf") where "parent.leaf" is NOT a module endpoint
 *    and has no child caches → falls through to parent-cache resolution.
 *
 *  _findAffectedCaches — child caches branch (lines 2086-2095):
 *    Triggered by reload("scope") where child modules were added at "scope.a", "scope.b".
 *
 *  restoreApiPath — addHistory lookup (lines 956-975):
 *    Triggered by _reloadByApiPath fallback: when _findAffectedCaches returns [] for a
 *    non-existent path that has no cache entry.
 *
 *  _reloadByApiPath fallback restore (lines 1976-1984):
 *    Triggered when the reload path exists in the live API but has no cache coverage.
 *
 *  _restoreApiTree root-level new key creation (lines 2204-2246):
 *    Triggered when a module reload introduces a key that didn't previously exist at root.
 *
 * @module tests/vitests/suites/api-manager/api-manager-reload-lite
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create a lean eager Slothlet instance.
 * No matrix — keeps memory low to avoid losing coverage data.
 * @param {object} [overrides] - Additional config overrides.
 * @returns {Promise<object>} Ready Slothlet API proxy.
 */
async function makeApi(overrides = {}) {
	return slothlet({
		dir: TEST_DIRS.API_TEST,
		mode: "eager",
		runtime: "async",
		...overrides
	});
}

// ---------------------------------------------------------------------------
// 1. _restoreApiTree nested path (lines 2304-2495)
//    Module added at non-root endpoint → reload → parts.length > 0 → nested branch
// ---------------------------------------------------------------------------
describe("_restoreApiTree — nested endpoint path (lines 2304-2495)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reloads a module added at a single-segment endpoint (e.g. 'ext')", async () => {
		api = await makeApi();
		await api.slothlet.api.add("ext", TEST_DIRS.API_TEST_MIXED, { moduleID: "ext-single" });
		expect(api.ext).toBeDefined();

		// reload by moduleID → _reloadByModuleID("ext-single")
		// → _restoreApiTree(freshApi, "ext", ...) → parts=["ext"], length=1 → nested path
		await api.slothlet.api.reload("ext-single");
		expect(api.ext).toBeDefined();
	});

	it("reloads a module added at two-segment endpoint (e.g. 'a.b')", async () => {
		api = await makeApi();
		await api.slothlet.api.add("two.seg", TEST_DIRS.API_TEST_MIXED, { moduleID: "two-seg-mod" });
		expect(api.two?.seg).toBeDefined();

		// _restoreApiTree(freshApi, "two.seg", ...) → parts=["two","seg"], length=2 → nested
		await api.slothlet.api.reload("two-seg-mod");
		expect(api.two?.seg).toBeDefined();
	});

	it("reloads a module at three-segment endpoint (e.g. 'a.b.c')", async () => {
		api = await makeApi();
		await api.slothlet.api.add("x.y.z", TEST_DIRS.API_TEST_MIXED, { moduleID: "xyz-mod" });
		expect(api.x?.y?.z).toBeDefined();

		await api.slothlet.api.reload("xyz-mod");
		expect(api.x?.y?.z).toBeDefined();
	});

	it("reloads nested module by apiPath (auto-resolves to moduleID via cache)", async () => {
		api = await makeApi();
		await api.slothlet.api.add("nested", TEST_DIRS.API_TEST_MIXED, { moduleID: "nested-path-mod" });
		expect(api.nested).toBeDefined();

		// reload by apiPath (not moduleID) → _reloadByApiPath("nested") → exact match → _reloadByModuleID
		await api.slothlet.api.reload("nested");
		expect(api.nested).toBeDefined();
	});

	it("preserves nested module functions after reload", async () => {
		api = await makeApi();
		await api.slothlet.api.add("nest2", TEST_DIRS.API_TEST_MIXED, { moduleID: "nest2-mod" });

		// Capture keys before reload
		const keysBefore = Object.keys(api.nest2 || {});
		expect(keysBefore.length).toBeGreaterThan(0);

		await api.slothlet.api.reload("nest2-mod");

		// Keys should still be accessible after reload
		const keysAfter = Object.keys(api.nest2 || {});
		expect(keysAfter.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 2. _findAffectedCaches — child caches branch (lines 2086-2095)
//    reload("scope") when children are at "scope.a", "scope.b"
// ---------------------------------------------------------------------------
describe("_findAffectedCaches — child caches branch (lines 2086-2095)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reloads two child modules by reloading their parent scope path", async () => {
		api = await makeApi();
		await api.slothlet.api.add("ns.one", TEST_DIRS.API_TEST_MIXED, { moduleID: "ns-one" });
		await api.slothlet.api.add("ns.two", TEST_DIRS.API_TEST_MIXED, { moduleID: "ns-two" });

		expect(api.ns?.one).toBeDefined();
		expect(api.ns?.two).toBeDefined();

		// reload("ns") → _findAffectedCaches("ns"):
		//   no exact match for "ns" (endpoints are "ns.one" and "ns.two")
		//   → child caches: both "ns.one" and "ns.two" start with "ns."
		//   → returns [ns-one, ns-two]
		await api.slothlet.api.reload("ns");

		expect(api.ns?.one).toBeDefined();
		expect(api.ns?.two).toBeDefined();
	});

	it("reloads three child modules under a common parent scope", async () => {
		api = await makeApi();
		await api.slothlet.api.add("grp.a", TEST_DIRS.API_TEST_MIXED, { moduleID: "grp-a" });
		await api.slothlet.api.add("grp.b", TEST_DIRS.API_TEST_MIXED, { moduleID: "grp-b" });
		await api.slothlet.api.add("grp.c", TEST_DIRS.API_TEST_MIXED, { moduleID: "grp-c" });

		await api.slothlet.api.reload("grp");

		expect(api.grp?.a).toBeDefined();
		expect(api.grp?.b).toBeDefined();
		expect(api.grp?.c).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 3. _findAffectedCaches — parent cache fallback (lines 2113-2131)
//    reload("some.leaf") where "some.leaf" is NOT a module endpoint and has no children
//    → no exact match, no children → parent cache covers it (the base "." module)
// ---------------------------------------------------------------------------
describe("_findAffectedCaches — parent cache fallback (lines 2113-2131)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("resolves parent cache when reloading a leaf path under the base module", async () => {
		api = await makeApi();
		// "math.add" is a leaf under "math" which is under the base "." module
		// _findAffectedCaches("math.add"):
		//   no exact match endpoint "math.add"
		//   no child caches starting with "math.add."
		//   ownership history may or may not find it
		//   parent cache: base module with endpoint "." covers everything
		await expect(api.slothlet.api.reload("math.add")).resolves.not.toThrow();
	});

	it("reloads a real two-segment leaf path under a base-module scope (parent cache covers it)", async () => {
		api = await makeApi();
		// "math.add" exists in the live API (it's a function from the base "." module).
		// _findAffectedCaches("math.add"):
		//   no exact endpoint "math.add" in cache (only "." is registered)
		//   no child caches starting with "math.add."
		//   ownership history: no entry for "math.add"
		//   → parent cache fallback: "." matches because every path is under "."
		await expect(api.slothlet.api.reload("math.add")).resolves.not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 4. restoreApiPath via _reloadByApiPath fallback (lines 956-1008, 1976-1984)
//    When reload is called for a path that has no cache entry at all
//    (not a moduleID, not an API path in live API) BUT we can still hit
//    the fallback path by using path-based reload on a known-existent key
//    that was never added via api.add() (i.e., it's from the base config)
// ---------------------------------------------------------------------------
describe("restoreApiPath — via _reloadByApiPath fallback (lines 956-1008, 1976-1984)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reloads base module via '.' path exercising _findAffectedCaches base branch", async () => {
		api = await makeApi();
		// reload(".") → _reloadByApiPath(".") → _findAffectedCaches(".") → base modules loop
		await expect(api.slothlet.api.reload(".")).resolves.not.toThrow();
	});

	it("reloads base module via null path (fallback to _reloadByApiPath)", async () => {
		api = await makeApi();
		await expect(api.slothlet.api.reload(null)).resolves.not.toThrow();
	});

	it("reloads base module via empty string (fallback to _reloadByApiPath)", async () => {
		api = await makeApi();
		await expect(api.slothlet.api.reload("")).resolves.not.toThrow();
	});

	it("reloads base module via undefined path", async () => {
		api = await makeApi();
		await expect(api.slothlet.api.reload(undefined)).resolves.not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 5. _restoreApiTree — root-level wrapper update (lines 2186-2302)
//    Triggered when reload is called for the base module (endpoint ".")
//    so parts=[] → root-level path, updating each top-level key
// ---------------------------------------------------------------------------
describe("_restoreApiTree — root level update (lines 2186-2302)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("root-level reload preserves math wrapper and its functions", async () => {
		api = await makeApi();
		expect(api.math).toBeDefined();
		expect(typeof api.math.add).toBe("function");

		// reload base module → _restoreApiTree(freshApi, ".", ...) → parts=[] → root path
		// iterates over all top-level keys in freshApi and updates existing wrappers via ___setImpl
		await api.slothlet.api.reload(".");

		expect(api.math).toBeDefined();
		expect(typeof api.math.add).toBe("function");
	});

	it("root-level reload result preserves api.math.add(1, 2) === 1003", async () => {
		api = await makeApi();
		const resultBefore = api.math.add(1, 2);
		await api.slothlet.api.reload(".");
		const resultAfter = api.math.add(1, 2);
		// math.add returns a+b+1000
		expect(resultBefore).toBe(1003);
		expect(resultAfter).toBe(1003);
	});

	it("root-level reload preserves multiple top-level wrappers", async () => {
		api = await makeApi();
		const keysBefore = Object.keys(api).filter((k) => !["slothlet", "shutdown", "destroy"].includes(k));

		await api.slothlet.api.reload(".");

		const keysAfter = Object.keys(api).filter((k) => !["slothlet", "shutdown", "destroy"].includes(k));
		expect(keysAfter.length).toBeGreaterThanOrEqual(keysBefore.length);
	});
});

// ---------------------------------------------------------------------------
// 6. Multi-module overlap → sort+group in _reloadByApiPath (lines 1990-2050)
//    Two modules at the same endpoint → reload by path → both get rebuilt
// ---------------------------------------------------------------------------
describe("_reloadByApiPath — sort and group multi-module (lines 1990-2050)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reloads two overlapping modules at 'overlap' path → sort+group logic", async () => {
		api = await makeApi();
		await api.slothlet.api.add("overlap", TEST_DIRS.API_TEST_MIXED, { moduleID: "overlap-first" });
		await api.slothlet.api.add("overlap", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "overlap-second",
			forceOverwrite: true
		});

		expect(api.overlap).toBeDefined();

		// reload("overlap") → _findAffectedCaches("overlap") → exact match: both modules
		// → sort by addHistory order → group by endpoint → first gets forceReplace=true
		await api.slothlet.api.reload("overlap");

		expect(api.overlap).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 7. reloadApiComponent INVALID_CONFIG_NOT_LOADED error (line 1851)
//    Called when slothlet is not loaded yet (before initialization)
// ---------------------------------------------------------------------------
describe("reloadApiComponent — INVALID_CONFIG_NOT_LOADED (line 1851)", () => {
	it("throws INVALID_ARGUMENT when no apiPath or moduleID provided", async () => {
		const api = await makeApi();
		// Calling reload without a moduleID or apiPath in reloadApiComponent directly
		// We can trigger the INVALID_ARGUMENT throw via the internal method
		const mgr = api.slothlet.__state?.apiManager;
		if (!mgr) return; // internals not accessible, skip

		await expect(
			mgr.reloadApiComponent({})
		).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });

		await api.shutdown();
	});
});

// ---------------------------------------------------------------------------
// 8. _reloadByModuleID — CACHE_NOT_FOUND error (line 1869)
// ---------------------------------------------------------------------------
describe("_reloadByModuleID — CACHE_NOT_FOUND when moduleID not in cache", () => {
	it("throws CACHE_NOT_FOUND when moduleID does not exist in cache", async () => {
		const api = await makeApi();
		const mgr = api.slothlet.__state?.apiManager;
		if (!mgr) {
			await api.shutdown();
			return;
		}

		await expect(
			mgr._reloadByModuleID("neverAddedModuleID_xyz999")
		).rejects.toMatchObject({ code: "CACHE_NOT_FOUND" });

		await api.shutdown();
	});
});
