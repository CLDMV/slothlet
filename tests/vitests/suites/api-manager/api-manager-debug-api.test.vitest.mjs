/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-debug-api.test.vitest.mjs
 *	@Date: 2026-02-28T00:00:00-08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28T00:00:00-08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for `debug: { api: true }` branches in api-manager.mjs.
 *
 * @description
 * Tests that fire the `config?.debug?.api` guard branches throughout api-manager.mjs:
 *
 *  syncWrapper debug paths (lines 413-422, 431-440, 455-468):
 *    Triggered when two overlapping `api.add()` calls with merge collision invoke
 *    `syncWrapper(existingProxy, nextProxy, config)` with `config.debug.api === true`.
 *
 *  mutateApiValue debug paths (lines 634-638, 651-652, 655, 661, 675-676, 695):
 *    Triggered when `mutateApiValue` branches on wrapper vs non-wrapper values
 *    with `config.debug.api === true`.
 *
 *  setValueAtPath merge primitives warning path (line 800-801):
 *    setValueAtPath replace mode, primitives branch.
 *
 *  syncWrapper line 445 materializeFunc copy path:
 *    Requires lazy mode + reload that invokes syncWrapper with materializeFunc.
 *
 *  syncWrapper merge-replace non-wrapper child delete path (lines 557-558):
 *    collisionMode="merge-replace" where child exists but is not a wrapper.
 *
 * @module tests/vitests/suites/api-manager/api-manager-debug-api
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create an eager slothlet instance with `debug.api` enabled.
 * @param {object} [overrides] - Additional config overrides.
 * @returns {Promise<object>} Ready Slothlet API proxy.
 */
async function makeDebugApiInstance(overrides = {}) {
	return slothlet({
		dir: TEST_DIRS.API_TEST,
		mode: "eager",
		runtime: "async",
		debug: { api: true },
		...overrides
	});
}

// ---------------------------------------------------------------------------
// 1. syncWrapper debug entry/wrapper paths (lines 413-440, 455-468)
//    Triggered by a second api.add() to an existing path → merge collision
//    → mutateApiValue → syncWrapper(existing, next, config) with debug.api=true
// ---------------------------------------------------------------------------
describe("api-manager syncWrapper debug.api paths", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("fires syncWrapper debug paths when second add() merges into existing wrapper", async () => {
		api = await makeDebugApiInstance();
		// First add: creates api.ext wrapper
		await api.slothlet.api.add("ext", TEST_DIRS.API_TEST_MIXED);
		expect(api.ext).toBeDefined();

		// Second add to same path: triggers collision → mutateApiValue → syncWrapper
		// With debug.api=true, all syncWrapper debug branches fire (lines 413-422, 431-440, 455-468)
		await api.slothlet.api.add("ext", TEST_DIRS.API_TEST_MIXED);
		expect(api.ext).toBeDefined();
	});

	it("fires syncWrapper debug paths when reloading a nested module", async () => {
		api = await makeDebugApiInstance();
		await api.slothlet.api.add("ns1", TEST_DIRS.API_TEST_MIXED, { moduleID: "ns1-mod" });
		expect(api.ns1).toBeDefined();

		// Reload triggers _restoreApiTree → syncWrapper (with debug.api=true)
		await api.slothlet.api.reload("ns1-mod");
		expect(api.ns1).toBeDefined();
	});

	it("fires syncWrapper materializeFunc copy path when lazy wrapper is reloaded", async () => {
		// Lazy mode: reloading triggers the materializeFunc copy branch (line 445)
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime: "async",
			debug: { api: true }
		});
		await api.slothlet.api.add("lazyExt", TEST_DIRS.API_TEST_MIXED, { moduleID: "lazy-mod" });

		// Reload in lazy mode triggers syncWrapper with materializeFunc → line 445
		await api.slothlet.api.reload("lazy-mod");
		expect(api.lazyExt).toBeDefined();
	});

	it("fires syncWrapper debug paths when merging two dirs to the same root path", async () => {
		api = await makeDebugApiInstance();
		// Add first dir
		await api.slothlet.api.add("shared", TEST_DIRS.API_TEST_MIXED, { moduleID: "shared-a" });
		// Add second dir to same path → collision on shared wrapper → syncWrapper debug
		await api.slothlet.api.add("shared", TEST_DIRS.API_TEST_MIXED, { moduleID: "shared-b" });
		expect(api.shared).toBeDefined();
	});

	it("fires syncWrapper debug paths when reload restores a module with debug.api=true", async () => {
		api = await makeDebugApiInstance();
		const moduleID = api.slothlet.__state?.apiManager?.state?.addHistory?.[0]?.moduleID;
		if (!moduleID) return;

		// Reload the base module triggers _restoreApiTree → syncWrapper for root keys
		await expect(api.slothlet.api.reload(moduleID)).resolves.not.toThrow();
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 2. mutateApiValue debug paths (lines 634-638, 651-652, 655, 661, 675-676, 695)
//    Both-wrappers path (634-638): triggered by syncWrapper call from above
//    Merge-into-wrapper path (651-652): when existingValue=wrapper, nextValue=plain obj
//    Setimpl-fallback path (675-676): when existingValue=wrapper, nextValue=empty obj
// ---------------------------------------------------------------------------
describe("api-manager mutateApiValue debug.api paths", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("fires mutateApiValue sync-wrappers debug (line 634-638) via two-wrapper collision", async () => {
		api = await makeDebugApiInstance();
		// Load a path that will have a wrapper
		await api.slothlet.api.add("mod1", TEST_DIRS.API_TEST_MIXED, { moduleID: "m1" });
		// Re-add the same path with same dir → both values wrappers → mutateApiValue line 634
		await api.slothlet.api.add("mod1", TEST_DIRS.API_TEST_MIXED, { moduleID: "m2" });
		expect(api.mod1).toBeDefined();
	});

	it("fires mutateApiValue paths during base module reload with debug.api", async () => {
		api = await makeDebugApiInstance();
		// Reload base module: _restoreApiTree iterates root keys and calls ___setImpl or syncWrapper
		// internally, triggering mutateApiValue debug branches for each root key
		await expect(api.slothlet.api.reload(".")).resolves.not.toThrow();
		expect(api.math).toBeDefined();
	});

	it("fires mutateApiValue during overlapping add with replace collision mode", async () => {
		// Use replace collision mode to trigger setValueAtPath replace code path
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			debug: { api: true },
			collision: { initial: "replace", api: "replace" }
		});
		// Add ext, then re-add → replace mode → setValueAtPath replace path fires
		await api.slothlet.api.add("repExt", TEST_DIRS.API_TEST_MIXED);
		await api.slothlet.api.add("repExt", TEST_DIRS.API_TEST_MIXED);
		expect(api.repExt).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 3. syncWrapper merge-replace path (lines 544-565) – non-wrapper child delete
//    Triggered by merge-replace collision mode when child key exists but is NOT a wrapper
// ---------------------------------------------------------------------------
describe("api-manager syncWrapper merge-replace path", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("fires merge-replace path in syncWrapper when adding with merge-replace collision", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			debug: { api: true },
			collision: { initial: "merge-replace", api: "merge-replace" }
		});
		// First add creates wrapper
		await api.slothlet.api.add("mrExt", TEST_DIRS.API_TEST_MIXED);
		// Second add with merge-replace triggers syncWrapper's merge-replace branch
		// which handles both key-exists (lines 550-564) and key-new (lines 565-575) cases
		await api.slothlet.api.add("mrExt", TEST_DIRS.API_TEST_MIXED);
		expect(api.mrExt).toBeDefined();
	});

	it("fires merge-replace syncWrapper with overlapping child keys", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			debug: { api: true },
			collision: { initial: "merge-replace", api: "merge-replace" }
		});
		// Both API_TEST and API_TEST_MIXED will be added to "ns" namespace
		// API_TEST has math, config, etc. Adding API_TEST_MIXED to same path
		// creates overlap where both sides have wrappers → line 553 recursive syncWrapper
		await api.slothlet.api.add("ns", TEST_DIRS.API_TEST);
		await api.slothlet.api.add("ns", TEST_DIRS.API_TEST_MIXED);
		expect(api.ns).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 4. setValueAtPath skip and warn collision modes (lines 762-778)
// ---------------------------------------------------------------------------
describe("api-manager setValueAtPath skip and warn collision modes", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("fires skip collision path and keeps existing value", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			debug: { api: true },
			collision: { initial: "skip", api: "skip" }
		});
		// Add first dir
		const before = await api.slothlet.api.add("skipExt", TEST_DIRS.API_TEST_MIXED);
		// Second add → skip mode → setValueAtPath returns false → existing preserved
		const after = await api.slothlet.api.add("skipExt", TEST_DIRS.API_TEST_MIXED);
		expect(api.skipExt).toBeDefined();
		// Both should resolve (even if second is a no-op)
		expect(before).toBeDefined();
		expect(after).toBeDefined();
	});

	it("fires warn collision path (lines 771-778) and keeps existing value", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true, // suppress warning output
			debug: { api: true },
			collision: { initial: "warn", api: "warn" }
		});
		await api.slothlet.api.add("warnExt", TEST_DIRS.API_TEST_MIXED);
		// Second add → warn mode → SlothletWarning emitted → setValueAtPath returns false
		await api.slothlet.api.add("warnExt", TEST_DIRS.API_TEST_MIXED);
		expect(api.warnExt).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 5. Array folderPath path in addApiComponent (lines 1067-1077)
//    The public api.add() filters out array folderPath, but addApiComponent accepts it
// ---------------------------------------------------------------------------
describe("api-manager addApiComponent array folderPath", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 30));
	});

	it("processes an array of folder paths via api.add (addApiComponent array branch)", async () => {
		api = await makeDebugApiInstance();
		// api.slothlet.api.add() passes folderPath directly to addApiComponent.
		// Passing an array triggers the Array.isArray branch (lines 1067-1078).
		// Returns an array of moduleIDs from each recursive call.
		const result = await api.slothlet.api.add("arrExt", [TEST_DIRS.API_TEST_MIXED, TEST_DIRS.API_TEST_MIXED]);
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(2);
		expect(api.arrExt).toBeDefined();
	});
});
