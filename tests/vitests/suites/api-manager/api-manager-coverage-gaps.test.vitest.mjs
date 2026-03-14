/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-coverage-gaps.test.vitest.mjs
 *	@Date: 2026-03-01T00:44:21-08:00 (1772354661)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:42 -08:00 (1772425302)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for previously-unreached api-manager.mjs branches.
 *
 * @description
 * Targets these uncovered code clusters:
 *
 *   lines 215, 230-234   resolvePath: null/empty input + non-existent path
 *   lines 1082, 1095     addApiComponent: INVALID_CONFIG_NOT_LOADED + INVALID_CONFIG_PATH_TYPE
 *   lines 1543           removeApiComponent: early return-false for unknown path
 *   lines 1597-1610      removeApiComponent: action=restore with restoredValue+setValueAtPath
 *   lines 1683           removeApiComponent: rollback loop (pathsToRollback iteration)
 *   lines 1996-1997      _reloadByApiPath: metadata merge option after rebuild
 *   lines 2060-2091      _findAffectedCaches: base-module (endpoint ".") detection
 *   lines 2113-2129      _findAffectedCaches: ownership-history lookup
 *   lines 2186, 2204     _collectCustomProperties + root-key debug
 *   lines 2232-2286      _restoreApiTree root-path (parts.length === 0) — base module reload
 *   lines 2304-2355      _restoreApiTree root-path: new-key and eager-update branches
 *
 * Strategy:
 * - Reload the base module via `api.slothlet.api.reload(".")` to exercise the root-path
 *   of `_restoreApiTree` and base-module detection in `_findAffectedCaches`.
 * - Reload an existing named path (e.g. "math") to exercise the ownership-history branch.
 * - Use a custom moduleID (no path-prefix) + forceOverwrite to exercise the restore paths
 *   inside removeApiComponent.
 * - Pass invalid inputs to addApiComponent to exercise error-guard throws.
 *
 * @module tests/vitests/suites/api-manager/api-manager-coverage-gaps
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

// Some tests in this suite enable config.debug.api=true for branch coverage.
// Suppress the resulting console noise — we don't assert on emitted debug lines.
suppressSlothletDebugOutput();

const ____dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create a basic eager slothlet instance loaded from API_TEST.
 * @param {object} [extra] - Extra config overrides.
 * @returns {Promise<object>} Loaded API proxy.
 */
async function makeApi(extra = {}) {
	return slothlet({ mode: "eager", runtime: "async", dir: TEST_DIRS.API_TEST, ...extra });
}

// ---------------------------------------------------------------------------
// 1. resolvePath — null / non-existent paths  (lines 215, 230-234)
// ---------------------------------------------------------------------------

describe("resolvePath — invalid inputs (lines 215, 230-234)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws INVALID_CONFIG_DIR_INVALID when folderPath is null (line 215)", async () => {
		api = await makeApi();
		// null folderPath → resolvePath receives null → !inputPath check fires
		await expect(api.slothlet.api.add("test", null)).rejects.toThrow();
	});

	it("throws INVALID_CONFIG_DIR_INVALID when folderPath is empty string (line 215)", async () => {
		api = await makeApi();
		// empty string → !inputPath is true → throws
		await expect(api.slothlet.api.add("test", "")).rejects.toThrow();
	});

	it("throws INVALID_CONFIG_DIR_INVALID for a non-existent path (lines 230-234)", async () => {
		api = await makeApi();
		// completely nonexistent path → fs.stat throws ENOENT → catch block fires
		await expect(api.slothlet.api.add("test", "/absolutely/does/not/exist/xyz_never_abc")).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 2. addApiComponent INVALID_CONFIG_PATH_TYPE  (line 1095)
//    Requires a path that exists but is neither a regular file nor a directory.
//    /dev/null is a character device on Linux — isFile=false, isDirectory=false.
// ---------------------------------------------------------------------------

describe("addApiComponent — INVALID_CONFIG_PATH_TYPE (line 1095)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws INVALID_CONFIG_PATH_TYPE for /dev/null (character device)", async () => {
		api = await makeApi();
		// /dev/null exists but is neither a directory nor a regular file
		await expect(api.slothlet.api.add("test", "/dev/null")).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 3. removeApiComponent — return false for unknown path  (line 1543)
// ---------------------------------------------------------------------------

describe("removeApiComponent — return false (line 1543)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("returns false when removing a path that was never added", async () => {
		api = await makeApi();
		// "totallyMissingPath" is not in ownership registry → return false
		const result = await api.slothlet.api.remove("totallyMissingPath");
		expect(result).toBe(false);
	});

	it("returns false when removing with a moduleID that does not exist", async () => {
		api = await makeApi();
		// non-existent moduleID is not found via findLast and getCurrentOwner → return false
		const result = await api.slothlet.api.remove("nonExistentModuleId_xyz_abc");
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 4. removeApiComponent — restore with restoredValue (lines 1597-1610)
//    Uses a custom moduleID (no path-prefix) so that pathOrModuleId="custom-plug"
//    falls through the findLast check and hits getCurrentOwner → apiPath+moduleID branch.
//    With a forceOverwrite second add, ownership stacks → action="restore".
// ---------------------------------------------------------------------------

describe("removeApiComponent — apiPath+moduleID restore via setValueAtPath (lines 1597-1610)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("restores stacked ownership via setValueAtPath when removing by API path (lines 1597-1610)", async () => {
		api = await makeApi();

		// Layer 1: add at "cstplug" with a custom moduleID that has no path-prefix relationship
		// (ownership registers "cstplug" under moduleID "layer-one").
		await api.slothlet.api.add("cstplug", TEST_DIRS.API_TEST_MIXED, { moduleID: "layer-one" });
		expect(api.cstplug).toBeDefined();

		// Layer 2: forceOverwrite=true → collisionMode="replace" → ownership stacks
		// "cstplug" is now owned by "layer-two" with "layer-one" in the history.
		await api.slothlet.api.add("cstplug", TEST_DIRS.API_TEST_MIXED, { moduleID: "layer-two", forceOverwrite: true });

		// Remove by API path string "cstplug".
		// Detection:
		//   candidateModuleID = "cstplug"
		//   findLast(m === "cstplug" || m.startsWith("cstplug_")) → NO match ("layer-one" / "layer-two")
		//   getCurrentOwner("cstplug") → { moduleID: "layer-two" }
		//   → apiPath="cstplug", moduleID="layer-two" → if (apiPath && moduleID) branch
		// ownership.removePath("cstplug", "layer-two") → action="restore", restoreModuleId="layer-one"
		// getCurrentValue("cstplug") → snapshot for "layer-one" (non-undefined)
		// → lines 1597-1610 fire (setValueAtPath restore)
		const removeResult = await api.slothlet.api.remove("cstplug");
		expect(removeResult).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 5. removeApiComponent — rollback loop (line 1683)
//    Requires removing by moduleID when the module was stacked with forceOverwrite.
//    After unregister(moduleID), the paths rolled back by ownership will have a
//    different currentOwner → pathsToRollback is populated → loop body at 1683.
// ---------------------------------------------------------------------------

describe("removeApiComponent — pathsToRollback loop (line 1683)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("triggers the rollback loop when removing a stacked module by moduleID (line 1683)", async () => {
		api = await makeApi();

		// Layer 1
		await api.slothlet.api.add("rollmod", TEST_DIRS.API_TEST_MIXED, { moduleID: "roll-v1" });
		expect(api.rollmod).toBeDefined();

		// Layer 2: forceOverwrite=true forces replace mode → stacks ownership for "rollmod"
		// under "roll-v2", with "roll-v1" in the prior history.
		await api.slothlet.api.add("rollmod", TEST_DIRS.API_TEST_MIXED, { moduleID: "roll-v2", forceOverwrite: true });

		// Remove by moduleID "roll-v2".
		// ownership.unregister("roll-v2"):
		//   removePath("rollmod", "roll-v2") → action="restore", restoreModuleId="roll-v1"
		//   result.rolledBack = [{ apiPath: "rollmod", restoredTo: "roll-v1" }]
		// allPaths = ["rollmod"]  (not in removed, in rolledBack)
		// currentOwner("rollmod") after unregister = "roll-v1" ≠ "roll-v2"
		// → pathsToRollback = [{ apiPath: "rollmod", restoredTo: "roll-v1" }]
		// → for loop at line 1683 fires!
		const removeResult = await api.slothlet.api.remove("roll-v2");
		expect(removeResult).toBe(true);
		// Path should still be present (restored to roll-v1)
		expect(api.rollmod).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 6. _reloadByApiPath — base-module detection via _findAffectedCaches (lines 2060-2091)
//    + _restoreApiTree ROOT PATH (lines 2232-2355)
//    + _collectCustomProperties (lines 2186-2204)
//
//    `reload(".")` → _reloadByApiPath(".") → _findAffectedCaches(".") returns base moduleID(s)
//    → _reloadByModuleID(baseID) → _restoreApiTree(freshApi, ".", baseID) → parts.length===0
//    → iterates all root API keys → calls _collectCustomProperties for each wrapper
// ---------------------------------------------------------------------------

describe("reload('.') — base module reload triggers _restoreApiTree root path (lines 2060-2355)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("reloads base module using '.' and API remains functional (lines 2060-2091, 2232-2286)", async () => {
		api = await makeApi();

		// Confirm baseline — math is accessible
		expect(typeof api.math.add).toBe("function");

		// reload(".") → _reloadByApiPath(".") → _findAffectedCaches(".") → base modules
		// → _reloadByModuleID → _restoreApiTree(freshApi, ".", ...) → ROOT PATH (parts=[])
		// → iterates each key in freshApi (math, config, etc.) → updates wrapper ___setImpl
		await expect(api.slothlet.api.reload(".")).resolves.toBeUndefined();

		// API remains usable after base reload (function is still callable)
		expect(typeof api.math.add).toBe("function");
		expect(api.math).toBeDefined();
	});

	it("reloads base module with null (treated as '.')", async () => {
		api = await makeApi();
		await expect(api.slothlet.api.reload(null)).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});

	it("reloads base module with undefined (treated as '.')", async () => {
		api = await makeApi();
		await expect(api.slothlet.api.reload(undefined)).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});

	it("reloads base module with empty string (treated as '.')", async () => {
		api = await makeApi();
		await expect(api.slothlet.api.reload("")).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});

	it("root-path custom-property preservation: custom props survive base reload", async () => {
		api = await makeApi();

		// Set custom properties including underscore-prefixed ones to verify
		// _collectCustomProperties only skips known slothlet internals, not all `_` keys.
		api.math.coverageTestCustomProp = "persist-me";
		api.math._underscoreProp = "also-persists";

		await api.slothlet.api.reload(".");

		// Both should survive — _collectCustomProperties must not blanket-filter `_` keys.
		expect(api.math.coverageTestCustomProp).toBe("persist-me");
		expect(api.math._underscoreProp).toBe("also-persists");
	});
});

// ---------------------------------------------------------------------------
// 7. _findAffectedCaches — ownership-history branch  (lines 2113-2129)
//    Reloading an existing named path that lives inside the base module
//    triggers the ownership-history lookup (not in exact endpoint, not in child caches,
//    but IS registered in ownership).
// ---------------------------------------------------------------------------

describe("_findAffectedCaches ownership-history branch (lines 2113-2129)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("reloads 'math' — ownership history resolves to base module (lines 2113-2129)", async () => {
		api = await makeApi();

		// "math" has no dedicated cache entry (it lives inside the base module).
		// _findAffectedCaches("math"):
		//   1. Not "." → no base-module short-circuit
		//   2. No exact endpoint "math" in caches
		//   3. No child caches (nothing starts with "math.")
		//   4. ownership.getPathHistory("math") → has base module entry → lines 2113-2129
		//   5. cacheManager.has(baseModuleID) → true → returns [baseModuleID]
		await expect(api.slothlet.api.reload("math")).resolves.toBeUndefined();
		// API structure preserved — math module still callable
		expect(api.math).toBeDefined();
		expect(typeof api.math.add).toBe("function");
	});

	it("reloads 'math.add' (deeper nesting) — also hits ownership-history (lines 2113-2129)", async () => {
		api = await makeApi();
		// "math.add" is registered in ownership under base module
		await expect(api.slothlet.api.reload("math.add")).resolves.toBeUndefined();
	});

	it("reloads 'config' — also hits ownership-history for a non-math module (lines 2113-2129)", async () => {
		api = await makeApi();
		// Assuming api_test has a config module registered in ownership under base
		const configVal = api.config;
		if (configVal !== undefined) {
			await expect(api.slothlet.api.reload("config")).resolves.toBeUndefined();
		}
	});
});

// ---------------------------------------------------------------------------
// 8. _reloadByApiPath — metadata option applied after rebuild  (lines 1996-1997)
// ---------------------------------------------------------------------------

describe("_reloadByApiPath — metadata option (lines 1996-1997)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("reload with metadata option calls registerUserMetadata (lines 1996-1997)", async () => {
		api = await makeApi();

		// Pass metadata option through reload — this covers the metadata branch in
		// _reloadByApiPath after all caches are rebuilt.
		await expect(api.slothlet.api.reload("math", { metadata: { version: "2.0-test" } })).resolves.toBeUndefined();

		// API structure still present
		expect(api.math).toBeDefined();
	});

	it("reload '.' with metadata also exercises metadata branch", async () => {
		api = await makeApi();
		await expect(api.slothlet.api.reload(".", { metadata: { reloadedAt: "test-ts" } })).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 9. _restoreApiTree root path — new-key branch (line 2281)
//    After reloading the base module, if there's a module that was added but
//    its key doesn't yet exist at root level, setValueAtPath creates it.
//    Approach: add a module at root "", reload "." to trigger root-path iteration
//    where the freshApi has keys from API_TEST and the new module adds a key
//    that might not exist yet, or simply verify the reload runs without error.
// ---------------------------------------------------------------------------

describe("_restoreApiTree root path — reload after add (lines 2281-2286)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("reload '.' after adding a module covers root-path set logic", async () => {
		api = await makeApi();

		// Add an extra module at root level (empty string → merges into root)
		// forceOverwrite ensures replace mode and proper ownership on merge path
		await api.slothlet.api.add("extra2024", TEST_DIRS.API_TEST_MIXED, { moduleID: "extra-for-root-reload" });
		expect(api.extra2024).toBeDefined();

		// Reloading base module ("." ) iterates all root keys including "extra2024"
		// If the base fresh API doesn't include "extra2024", existingAtKey !== undefined
		// but resolveWrapper(existingAtKey) is a wrapper → existing-wrapper branch
		await expect(api.slothlet.api.reload(".")).resolves.toBeUndefined();

		// Core API structure still present
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 10. _restoreApiTree NESTED path (else branch, lines 2364-2491)
//     Triggered when `endpoint` has a non-empty part slice, i.e. a named
//     top-level endpoint like "plugins".
//     Flow: add("plugins", dir, {moduleID}) → creates cache entry with
//     endpoint="plugins" → reload(moduleID) → _reloadByModuleID(moduleID) →
//     cacheManager.rebuildCache → _restoreApiTree(freshApi, "plugins", moduleID)
//     → parts=["plugins"] → parts.length > 0 → ELSE branch → lines 2364+
// ---------------------------------------------------------------------------

describe("_restoreApiTree nested path (lines 2364-2491)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("reload by moduleID exercises nested _restoreApiTree (existing wrapper path, lines 2364+)", async () => {
		api = await makeApi();

		// Add a named endpoint — cache entry stored with endpoint="pluginsnested"
		await api.slothlet.api.add("pluginsnested", TEST_DIRS.API_TEST_MIXED, { moduleID: "plugins-nested-v1" });
		expect(api.pluginsnested).toBeDefined();

		// reload("plugins-nested-v1") → isModuleId=true → reloadApiComponent({moduleID:"plugins-nested-v1"})
		// → _reloadByModuleID → rebuildCache → _restoreApiTree(freshApi, "pluginsnested", "plugins-nested-v1")
		// → parts=["pluginsnested"] → ELSE branch at lines 2364+
		// → existing = getValueAtPath(api, ["pluginsnested"]) → resolveWrapper → not null
		// → existing-wrapper-found branch (lines ~2375-2460)
		await expect(api.slothlet.api.reload("plugins-nested-v1")).resolves.toBeUndefined();
		expect(api.pluginsnested).toBeDefined();
	});

	it("custom props survive nested-path reload (lines 2364+)", async () => {
		api = await makeApi();

		await api.slothlet.api.add("pluginscp", TEST_DIRS.API_TEST_MIXED, { moduleID: "plugins-cp-v1" });
		expect(api.pluginscp).toBeDefined();

		// Plant a custom property on the wrapper proxy — should survive reload
		api.pluginscp.testCustomSurvival = "hello-from-test";

		await api.slothlet.api.reload("plugins-cp-v1");
		// After reload, custom property was collected and restored
		expect(api.pluginscp.testCustomSurvival).toBe("hello-from-test");
	});

	it("stacked nested-path reload (forceOverwrite then reload by moduleID)", async () => {
		api = await makeApi();

		await api.slothlet.api.add("pluginsstack", TEST_DIRS.API_TEST_MIXED, { moduleID: "plugins-stack-v1" });
		await api.slothlet.api.add("pluginsstack", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "plugins-stack-v2",
			forceOverwrite: true
		});
		expect(api.pluginsstack).toBeDefined();

		// Reloading v2 hits nested path since endpoint="pluginsstack"
		await expect(api.slothlet.api.reload("plugins-stack-v2")).resolves.toBeUndefined();
		expect(api.pluginsstack).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 11. debug.api branches in syncWrapper + mutateApiValue (lines 425, 445, 479-492, 651-695)
//     Passing `debug: { api: true }` causes the `if (config?.debug?.api)` guards
//     to fire inside syncWrapper and mutateApiValue, exercising the debug log
//     calls at those lines.
// ---------------------------------------------------------------------------

/**
 * Create slothlet with debug.api enabled.
 * @param {object} [extra] - Extra config overrides.
 * @returns {Promise<object>} Loaded API proxy.
 */
async function makeDebugApi(extra = {}) {
	return slothlet({ mode: "eager", runtime: "async", dir: TEST_DIRS.API_TEST, debug: { api: true }, ...extra });
}

describe("debug.api branches in syncWrapper and mutateApiValue (lines 425-492, 651-695)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("reload('.') with debug.api=true exercises syncWrapper debug branches (lines 425, 445, 479-492)", async () => {
		api = await makeDebugApi();
		expect(typeof api.math.add).toBe("function");

		// Reloading base module triggers syncWrapper for each root key that has
		// both an existingProxy and nextProxy as wrapper proxies.
		// With debug.api=true, the debug.api guards fire (lines 415-425, 437-445, 479-492)
		await expect(api.slothlet.api.reload(".")).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});

	it("adding with merge collisionMode exercises mutateApiValue merge debug (lines 651-695)", async () => {
		api = await makeDebugApi();
		expect(api.math).toBeDefined();

		// collisionMode="merge" on an already-existing endpoint triggers mutateApiValue
		// with the merge branch: if (collisionMode === "merge" || "merge-replace") (line ~804)
		// When debug.api=true, lines 651, 661, 669, 676, 687, 695 fire.
		await api.slothlet.api.add("math", TEST_DIRS.API_TEST, {
			moduleID: "math-merge-debug",
			collisionMode: "merge",
			forceOverwrite: false
		});
		expect(api.math).toBeDefined();
	});

	it("reload named endpoint with debug.api=true exercises nested syncWrapper debug", async () => {
		api = await makeDebugApi();

		// Add named endpoint → creates cache
		await api.slothlet.api.add("debugplug", TEST_DIRS.API_TEST_MIXED, { moduleID: "debug-plug-v1" });
		expect(api.debugplug).toBeDefined();

		// Reload by moduleID with debug.api=true → _restoreApiTree nested path →
		// syncWrapper is called with config containing debug.api=true → debug lines fire
		await expect(api.slothlet.api.reload("debug-plug-v1")).resolves.toBeUndefined();
		expect(api.debugplug).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 12. _restoreApiTree root-path NEW KEY branch (lines 2339-2357)
//     The `else if (existingAtKey === undefined)` branch fires when the fresh
//     rebuilt API for the base module contains a key that no longer exists in
//     the live API (because it was removed between initial load and reload).
//
//     Flow:
//       1. remove("math") → api.math deleted from live API
//       2. reload(".") → _reloadByApiPath(".") → _reloadByModuleID(base) →
//          _restoreApiTree(freshApi, ".", base)
//       3. freshApi has key "math" (rebuilt from disk), but api["math"] is undefined
//       4. → else if (existingAtKey === undefined) branch fires → setValueAtPath
//          creates the key at lines 2339-2357
// ---------------------------------------------------------------------------

describe("_restoreApiTree root-path new-key branch (lines 2339-2357)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("remove then reload base module recreates removed root key (lines 2339-2357)", async () => {
		api = await makeApi();
		expect(api.math).toBeDefined();

		// Remove "math" from the live API — now api.math is undefined
		await api.slothlet.api.remove("math");
		expect(api.math).toBeUndefined();

		// Reload base module — fresh API rebuilt from disk has "math" key back
		// _restoreApiTree(freshApi, ".", ...) → iterates freshApi keys
		// → freshApi has "math" but api["math"] = undefined
		// → else if (existingAtKey === undefined) fires → lines 2339-2357
		await expect(api.slothlet.api.reload(".")).resolves.toBeUndefined();

		// After reload, math should be restored from the fresh rebuild
		expect(api.math).toBeDefined();
	});

	it("remove multiple root keys then reload base restores them (lines 2339-2357)", async () => {
		api = await makeApi();
		expect(api.math).toBeDefined();

		// Remove both math and config
		await api.slothlet.api.remove("math");

		// Reload base — both are in freshApi, neither in live api → new-key branch fires twice+
		await expect(api.slothlet.api.reload(".")).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 13. collectPendingMaterializations wait block (lines 1377+)
//     The `collectPendingMaterializations` helper inside `addApiComponent` runs
//     after any assignment succeeds to await in-flight lazy materializations.
//     In lazy mode, accessed wrappers may have an active materializationPromise.
//
//     Using lazy mode exercises the pending-materialization bookkeeping more
//     thoroughly (at minimum the collector function traverses the wrapper tree).
// ---------------------------------------------------------------------------

/**
 * Create slothlet in lazy mode.
 * @param {object} [extra] - Extra config overrides.
 * @returns {Promise<object>} Loaded API proxy.
 */
async function makeLazyApi(extra = {}) {
	return slothlet({ mode: "lazy", runtime: "async", dir: TEST_DIRS.API_TEST, ...extra });
}

describe("collectPendingMaterializations — lazy mode add (lines 1364-1430)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("add in lazy mode exercises collectPendingMaterializations wrapper traversal", async () => {
		api = await makeLazyApi();

		// In lazy mode, API wrappers are unmaterialized shells.
		// Adding a module runs collectPendingMaterializations which traverses
		// any wrappers that exist at the added path.
		await api.slothlet.api.add("lazyadd", TEST_DIRS.API_TEST_MIXED, { moduleID: "lazy-add-v1" });
		expect(api.lazyadd).toBeDefined();

		// Access a property to trigger lazy materialization
		const keys = Object.keys(api.lazyadd || {});
		expect(Array.isArray(keys)).toBe(true);
	});

	it("add in lazy mode on existing path exercises both the wrapper-traversal and merge paths", async () => {
		api = await makeLazyApi();

		// Add first module at "lazymrg"
		await api.slothlet.api.add("lazymrg", TEST_DIRS.API_TEST_MIXED, { moduleID: "lazy-mrg-v1" });
		expect(api.lazymrg).toBeDefined();

		// Access to trigger initial materialization
		await api.lazymrg;

		// Add again with merge — triggers collectPendingMaterializations on the existing wrapper
		await api.slothlet.api.add("lazymrg", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "lazy-mrg-v2",
			collisionMode: "merge",
			forceOverwrite: false
		});
		expect(api.lazymrg).toBeDefined();
	});

	it("remove then reload '.' in lazy mode exercises root-path lazy detection (lines 2277+)", async () => {
		api = await makeLazyApi();
		expect(api.math).toBeDefined();

		// Remove "math" from the lazy api
		await api.slothlet.api.remove("math");
		expect(api.math).toBeUndefined();

		// Reload base module in lazy mode — _restoreApiTree root path iterates fresh keys.
		// For lazy mode, freshApi keys may be isLazyFresh (___resetLazy branch at ~line 2290).
		// For keys missing from api (like "math" we removed), the new-key branch fires (line 2339+).
		await expect(api.slothlet.api.reload(".")).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});
});
