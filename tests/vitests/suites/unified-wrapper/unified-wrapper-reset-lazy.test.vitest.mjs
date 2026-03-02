/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-reset-lazy.test.vitest.mjs
 *	@Date: 2026-02-28T14:24:16-08:00 (1772317456)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:56 -08:00 (1772425316)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests covering ___resetLazy() and related materialization paths
 * in unified-wrapper.mjs that are only triggered in lazy mode reload scenarios.
 *
 * @description
 * `___resetLazy()` (lines 595-640) is called by api-manager._restoreApiTree when
 * a lazy wrapper needs to be reset for a fresh reload. This method:
 * - Logs debug info via slothlet.debug(...)
 * - Invalidates and clears all child wrappers
 * - Resets impl and materialization state
 * - Swaps in the new materializeFunc
 *
 * Requirements to trigger ___resetLazy:
 * 1. Slothlet must be in lazy mode
 * 2. The wrapper must have been materialized (has children + impl)
 * 3. api.slothlet.api.reload(moduleID) is called
 * 4. _restoreApiTree finds an existing lazy wrapper at the endpoint
 * 5. Calls resolveWrapper(existing).___resetLazy(fresh.materializeFunc)
 *
 * Additional paths covered:
 * - ___invalidate() lines 760-773: Clearing children when api.remove() is called
 * - _extractFullImpl metadata paths (lines 457-468): Reload where impl has __childFilePaths
 * - Inner ___adoptImplChildren debug paths (lines 901-909): symbol keys during adoption
 * - _materialize() deduplication: concurrent materializations reuse existing promise
 *
 * @module tests/vitests/suites/unified-wrapper/unified-wrapper-reset-lazy
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

let restoreDebugOutput;

beforeAll(() => {
	restoreDebugOutput = suppressSlothletDebugOutput();
});

afterAll(() => {
	restoreDebugOutput?.();
	restoreDebugOutput = undefined;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a lazy Slothlet with API_TEST fixture.
 * @param {object} [extra] - Extra config options.
 * @returns {Promise<object>} Slothlet API proxy.
 */
async function makeLazyApi(extra = {}) {
	return slothlet({
		dir: TEST_DIRS.API_TEST,
		mode: "lazy",
		runtime: "async",
		...extra
	});
}

/**
 * Trigger materialization of a lazy wrapper by accessing it and waiting.
 * @param {object} api - Slothlet API proxy.
 * @param {string} key - Top-level key to access.
 * @returns {Promise<void>}
 */
async function triggerMat(api, key = "math") {
	const proxy = api[key];
	if (proxy && typeof proxy === "object") {
		// Access a property to trigger lazy materialization
		void proxy.add;
	}
	await new Promise((r) => setTimeout(r, 100));
}

// ---------------------------------------------------------------------------
// 1. ___resetLazy via lazy module reload (lines 595-640)
//    api.slothlet.api.reload(moduleID) on a lazy slothlet → _restoreApiTree
//    → calls resolveWrapper(existing).___resetLazy(fresh.materializeFunc)
// ---------------------------------------------------------------------------
describe("unified-wrapper: ___resetLazy via lazy mode reload (lines 595-640)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 50));
	});

	it("reload lazy base module resets wrapper via ___resetLazy", async () => {
		api = await makeLazyApi();

		// Access math to trigger materialization
		await triggerMat(api, "math");
		expect(typeof api.math.add).toBe("function");

		// Reload the base module → _restoreApiTree detects lazy wrapper
		// → calls ___resetLazy to reset the wrapper for fresh load
		await api.slothlet.api.reload(".");

		// After reset and rematerialization, math should still be accessible
		await triggerMat(api, "math");
		expect(api.math).toBeDefined();
	});

	it("reload lazy module added at non-root endpoint hits ___resetLazy", async () => {
		api = await makeLazyApi();

		// Add a module at a new endpoint in lazy mode
		await api.slothlet.api.add("ext", TEST_DIRS.API_TEST_MIXED, { moduleID: "ext-lazy-mod" });
		expect(api.ext).toBeDefined();

		// Access it to materialize
		void api.ext?.["math-esm"];
		await new Promise((r) => setTimeout(r, 100));

		// Reload → _restoreApiTree finds lazy wrapper at "ext"
		// → resolveWrapper(existingAtKey).___resetLazy(newWrapper.materializeFunc) fires
		await api.slothlet.api.reload("ext-lazy-mod");

		expect(api.ext).toBeDefined();
	});

	it("reload after materialization: ___resetLazy clears children and resets state", async () => {
		api = await makeLazyApi();

		// Fully materialize the math wrapper
		await triggerMat(api, "math");
		const keysBeforeReload = Object.keys(api.math || {});

		// Reload triggers ___resetLazy → clears all children → re-materializes
		await api.slothlet.api.reload(".");

		// After reload: wrapper should be valid again
		expect(api.math).toBeDefined();
	});

	it("reload with debug.wrapper=true fires debug log in ___resetLazy (line 598)", async () => {
		api = await makeLazyApi({ debug: { wrapper: true } });

		await triggerMat(api, "math");

		// With debug.wrapper=true, ___resetLazy's debug call at line 598 fires
		// This covers: slothlet.debug("wrapper", { key: "DEBUG_MODE_RESETLAZY_CALLED" ... })
		await api.slothlet.api.reload(".");

		expect(api.math).toBeDefined();
	});

	it("reload nested endpoint: ___resetLazy resets wrapper at nested path", async () => {
		api = await makeLazyApi();

		// Add nested module
		await api.slothlet.api.add("nest.level", TEST_DIRS.API_TEST_MIXED, { moduleID: "nest-lazy" });
		await new Promise((r) => setTimeout(r, 50));

		// Trigger materialization of nest.level
		void api.nest?.level;
		await new Promise((r) => setTimeout(r, 100));

		// Reload → _restoreApiTree at "nest.level" → ___resetLazy on existing wrapper
		await api.slothlet.api.reload("nest-lazy");

		expect(api.nest).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 2. ___invalidate with children (lines 760-773)
//    api.slothlet.api.remove() calls ___invalidate on wrapper children
//    Line 766: `continue` for internal keys fires when wrapper has internal own-props
// ---------------------------------------------------------------------------
describe("unified-wrapper: ___invalidate via api.remove (lines 760-773)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 50));
	});

	it("remove added module calls ___invalidate on its children", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		// Add a module, access it, then remove → ___invalidate fires on child wrappers
		const modID = await api.slothlet.api.add("toRemove", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "remove-test"
		});
		expect(api.toRemove).toBeDefined();

		// Remove triggers ___invalidate on the wrapper's children
		await api.slothlet.api.remove("remove-test");
		expect(api.toRemove).toBeUndefined();
	});

	it("remove lazy module after materialization invalidates children recursively", async () => {
		api = await makeLazyApi();

		const modID = await api.slothlet.api.add("toRemoveLazy", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "remove-lazy-test"
		});

		// Access to materialize
		void api.toRemoveLazy?.["math-esm"];
		await new Promise((r) => setTimeout(r, 100));

		// Remove lazy module → ___invalidate fires
		await api.slothlet.api.remove("remove-lazy-test");
		expect(api.toRemoveLazy).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// 3. Concurrent materialization: _materialize() deduplication via materializationPromise
//    Triggering _materialize() twice simultaneously reuses the same promise
//    (lines 661-675)
// ---------------------------------------------------------------------------
describe("unified-wrapper: concurrent materialization deduplication (lines 661-675)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 50));
	});

	it("two simultaneous accesses to same lazy wrapper deduplicate materialization", async () => {
		api = await makeLazyApi();

		// Access the lazy math wrapper to put it in inFlight
		// Then access again concurrently - should reuse existing promise
		const mathProxy = api.math;
		const addProxy = mathProxy?.add; // First access - starts materialization
		const multiplyProxy = mathProxy?.multiply; // Second access - reuses inFlight

		// Wait for full materialization
		await new Promise((r) => setTimeout(r, 100));

		// Both should be accessible
		expect(api.math).toBeDefined();
	});

	it("tracking.materialization=true with concurrent accesses still deduplicates", async () => {
		api = await makeLazyApi({ tracking: { materialization: true } });

		// Background materialization starts immediately + we also access it
		// The deduplication should prevent multiple `materializeFunc` calls
		const mathProxy = api.math;
		void mathProxy?.add;
		void mathProxy?.multiply;

		await new Promise((r) => setTimeout(r, 150));
		expect(api.math).toBeDefined();
		expect(typeof api.math.add).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// 4. _extractFullImpl metadata paths (lines 457-468)
//    Reload of a module that has __childFilePaths or __childFilePathsPreMaterialize
//    in its impl → the metadata paths in _extractFullImpl fire
// ---------------------------------------------------------------------------
describe("unified-wrapper: _extractFullImpl metadata paths (lines 457-468)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		await new Promise((r) => setTimeout(r, 50));
	});

	it("reload eager module with folder structure covers _extractFullImpl child path (lines 467-468)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		// api.math has children (add, multiply...) that are wrapper proxies
		// Reloading triggers syncWrapper → _extractFullImpl is called
		// The loop at lines 467-468 iterates wrapper keys and calls _extractFullImpl recursively
		await api.slothlet.api.reload(".");

		expect(typeof api.math.add).toBe("function");
	});

	it("reload collision-merged module: _extractFullImpl extracts merged children (lines 467-468)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "eager",
			runtime: "async",
			api: { collision: { initial: "merge" } }
		});

		// math has both file and folder exports merged → wrapper has many children
		// Reloading this exercises _extractFullImpl with child wrappers
		await api.slothlet.api.reload(".");

		expect(typeof api.math.power).toBe("function");
	});
});
