/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/api-manager/api-manager-reload-root.test.vitest.mjs
 *      @Date: 2026-03-03T12:00:00-08:00 (1741032000)
 *      @Author: Nate Corcoran <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-03-03T12:00:00-08:00 (1741032000)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for _restoreApiTree root-endpoint path, _findAffectedCaches
 * bestMatch fallback, sort comparator execution, and not-loaded guards in api-manager.mjs.
 *
 * @description
 * Exercises previously uncovered reload and guard code paths:
 *
 *   lines 2234+      _restoreApiTree: parts.length === 0 (root endpoint "." branch).
 *                    Triggered by api.slothlet.api.reload("."), null, or "".
 *                    Runs the per-key wrapper-update loop for root-level modules.
 *
 *   lines 2113-2129  _findAffectedCaches: step 4 bestMatch parent-cache fallback.
 *                    Reached when handlers.ownership is null so steps 1-3 all miss.
 *                    The base module's endpoint "." then covers any non-root path.
 *
 *   lines 1996-1997  _reloadByApiPath sort comparator evaluated with 2+ modules.
 *                    Covered by reloading a path owned by two modules (ownership history
 *                    returns both → moduleIDsToReload.length >= 2 → sort() runs).
 *
 *   line  1082       addApiComponent: !isLoaded guard.
 *                    Triggered by setting sl.isLoaded = false then calling addApiComponent.
 *
 *   line  1543       removeApiComponent: !isLoaded guard.
 *                    Triggered by setting sl.isLoaded = false + sl.handlers.ownership = null
 *                    so the code reaches the guard rather than returning false early.
 *
 * @module tests/vitests/suites/api-manager/api-manager-reload-root
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Extract the raw Slothlet instance from an API proxy via wrapper resolution.
 * @param {object} api - Slothlet API proxy.
 * @param {string} [prop="math"] - A top-level property carrying a wrapper.
 * @returns {object} Internal Slothlet instance.
 */
function getSlInstance(api, prop = "math") {
	const wrapper = resolveWrapper(api[prop]);
	if (!wrapper) throw new Error(`resolveWrapper(api.${prop}) returned null`);
	return wrapper.slothlet;
}

// ---------------------------------------------------------------------------
// 1. Root endpoint reload — _restoreApiTree parts.length === 0 branch
//    Covers the block starting at if (parts.length === 0) inside _restoreApiTree
// ---------------------------------------------------------------------------
describe("root endpoint reload via '.' — _restoreApiTree root path", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reload('.') succeeds and preserves API structure (eager mode)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		expect(api.math).toBeDefined();

		// "." → _reloadByApiPath(".") → _findAffectedCaches(".") → base module
		// → _reloadByModuleID(baseModID) → _restoreApiTree(freshApi, ".", moduleID, ...)
		// → endpoint === "." → parts = [] → parts.length === 0 → root loop
		await expect(api.slothlet.api.reload(".")).resolves.not.toThrow();
		expect(api.math).toBeDefined();
	});

	it("reload(null) is normalised to base module reload (eager mode)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		expect(api.math).toBeDefined();

		await expect(api.slothlet.api.reload(null)).resolves.not.toThrow();
		expect(api.math).toBeDefined();
	});

	it("reload('') is normalised to base module reload (eager mode)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		expect(api.math).toBeDefined();

		await expect(api.slothlet.api.reload("")).resolves.not.toThrow();
		expect(api.math).toBeDefined();
	});

	it("reload('.') on a primitives-only API (eager mode)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST_PRIMITIVES, mode: "eager" });
		expect(api.numval).toBeDefined();

		// Root reload with primitive exports — root loop iterates numval, strval, boolval
		await expect(api.slothlet.api.reload(".")).resolves.not.toThrow();
		expect(api.numval).toBeDefined();
	});

	it("reload('.') preserves wrapper proxy identity for root keys (eager mode)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		const mathProxyBefore = api.math;
		expect(mathProxyBefore).toBeDefined();

		await api.slothlet.api.reload(".");

		// ___setImpl mutates the wrapper in-place; proxy reference must remain identical
		expect(api.math === mathProxyBefore).toBe(true);
	});

	it("reload('.') with hooks enabled (eager/hooks-on)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", runtime: "async", hook: { enabled: true } });
		expect(api.math).toBeDefined();

		await expect(api.slothlet.api.reload(".")).resolves.not.toThrow();
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 2. _findAffectedCaches bestMatch fallback — step 4 (lines 2113-2129)
//    Requires handlers.ownership === null so steps 1-3 all miss.
//    State is always restored in finally blocks.
// ---------------------------------------------------------------------------
describe("_findAffectedCaches bestMatch fallback — null ownership", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reloads top-level key via bestMatch when ownership is null (eager mode)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		const sl = getSlInstance(api);
		const savedOwnership = sl.handlers.ownership;

		sl.handlers.ownership = null;
		try {
			// "math" is not a moduleID and, with no ownership, has no step-1/2/3 match.
			// Step 4 (bestMatch): base module endpoint "." covers "math" → returns [baseModID].
			// _reloadByModuleID(baseModID) → _restoreApiTree(freshApi, ".", ...)  (also covers root path)
			await expect(api.slothlet.api.reload("math")).resolves.not.toThrow();
			expect(api.math).toBeDefined();
		} finally {
			sl.handlers.ownership = savedOwnership;
		}
	});

	it("bestMatch finds the parent cache for a primitive key with no ownership (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST_PRIMITIVES, mode: "eager" });
		const sl = getSlInstance(api, "numval");
		const savedOwnership = sl.handlers.ownership;

		sl.handlers.ownership = null;
		try {
			// "numval" exists in api, has no exact/child cache endpoints, no ownership → bestMatch
			await expect(api.slothlet.api.reload("numval")).resolves.not.toThrow();
			expect(api.numval).toBeDefined();
		} finally {
			sl.handlers.ownership = savedOwnership;
		}
	});

	it("root reload '.' still works with null ownership (eager mode)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		const sl = getSlInstance(api);
		const savedOwnership = sl.handlers.ownership;

		sl.handlers.ownership = null;
		try {
			// "." takes the step-0 base-module path, not bestMatch — also covers root path
			await expect(api.slothlet.api.reload(".")).resolves.not.toThrow();
		} finally {
			sl.handlers.ownership = savedOwnership;
		}
	});
});

// ---------------------------------------------------------------------------
// 3. Sort comparator execution — lines 1996-1997
//    Requires moduleIDsToReload.length >= 2 so Array.sort() comparator invokes.
//    Two modules at the same ownership path → ownership returns both IDs.
// ---------------------------------------------------------------------------
describe("_reloadByApiPath sort comparator — two modules for same path", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("sort comparator runs when two addApi modules share the same path (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		// Register two independent modules at the same top-level path.
		// After both adds, ownership.getPathHistory("shared") returns stacks for both IDs.
		// _findAffectedCaches step 3 collects both → moduleIDsToReload.length = 2.
		// sort() comparator is called for the pair → lines 1996-1997 evaluate to false
		// (neither module has endpoint ".") → falls through to addHistory-index sort.
		await api.slothlet.api.add("shared", TEST_DIRS.API_TEST, { moduleID: "sort-mod-a" });
		await api.slothlet.api.add("shared", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "sort-mod-b",
			collisionMode: "merge"
		});

		expect(api.shared).toBeDefined();

		await expect(api.slothlet.api.reload("shared")).resolves.not.toThrow();
		expect(api.shared).toBeDefined();
	});

	it("sort comparator runs for a second pair of sibling modules (eager)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });

		await api.slothlet.api.add("sortSibling", TEST_DIRS.API_TEST_MIXED, { moduleID: "sibling-a" });
		await api.slothlet.api.add("sortSibling", TEST_DIRS.API_TEST, {
			moduleID: "sibling-b",
			collisionMode: "merge"
		});

		expect(api.sortSibling).toBeDefined();
		await expect(api.slothlet.api.reload("sortSibling")).resolves.not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 4. Not-loaded guards — addApiComponent line 1082 and removeApiComponent line 1543
//    Uses internal state mutation (sl.isLoaded = false) to reach the guards without
//    performing a real shutdown that would clear other state.
// ---------------------------------------------------------------------------
describe("not-loaded guards via internal state mutation", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("addApiComponent throws INVALID_CONFIG_NOT_LOADED when isLoaded=false (line 1082)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		const sl = getSlInstance(api);
		const savedLoaded = sl.isLoaded;

		sl.isLoaded = false;
		try {
			// Call the internal method directly — addApiComponent first checks !isLoaded (line 1082)
			await expect(
				sl.handlers.apiManager.addApiComponent({
					dir: TEST_DIRS.API_TEST,
					apiPath: "test1082",
					moduleID: "guard-test-mod",
					collisionMode: "replace",
					forceOverwrite: false
				})
			).rejects.toThrow();
		} finally {
			sl.isLoaded = savedLoaded;
		}
	});

	it("removeApiComponent throws INVALID_CONFIG_NOT_LOADED when isLoaded=false and ownership null (line 1543)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager" });
		const sl = getSlInstance(api);
		const savedLoaded = sl.isLoaded;
		const savedOwnership = sl.handlers.ownership;

		sl.isLoaded = false;
		sl.handlers.ownership = null; // nulled so heuristic path runs; "noDots" → moduleID → line 1542-1543
		try {
			// With ownership=null, heuristic: "noDots" (no dot) → moduleID path
			// Line 1542: !isLoaded → true → throw INVALID_CONFIG_NOT_LOADED (line 1543)
			await expect(sl.handlers.apiManager.removeApiComponent("noDots")).rejects.toThrow();
		} finally {
			sl.isLoaded = savedLoaded;
			sl.handlers.ownership = savedOwnership;
		}
	});
});
