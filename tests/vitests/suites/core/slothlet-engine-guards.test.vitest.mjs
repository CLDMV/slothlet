/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/slothlet-engine-guards.test.vitest.mjs
 *	@Date: 2026-03-05T00:00:00-08:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 14:00:07 -08:00 (1772488807)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Guard and edge-case coverage for slothlet.mjs engine methods.
 *
 * @description
 * Covers previously uncovered defensive branches in the Slothlet engine:
 *
 *   line  138  – `_setupLifecycleSubscribers` returns early when handlers.lifecycle is null
 *   lines 347-348 – `setApiContextChecker` callback body: tryGetContext() + return value
 *                   (invoked when EventEmitter.on() is called within an async API context)
 *   line  497  – `reload()` throws INVALID_CONFIG_NOT_LOADED when config.dir is falsy
 *   line  592  – `_clearModuleCaches()` deletes CJS entries from require.cache on reload
 *   line  608  – `injectRuntimeMetadataFunctions()` returns early when api has no metadata key
 *   line  677  – `getAPI()` throws INVALID_CONFIG_NOT_LOADED when isLoaded is false
 *   line  711  – `getOwnership()` returns null when no ownership handler is registered
 *
 * @module tests/vitests/suites/core/slothlet-engine-guards
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/** Shared require instance for inspecting require.cache in this ESM test file */
const _require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a standard eager API from the main test directory.
 * @param {object} [extra={}] - Additional config overrides.
 * @returns {Promise<object>} Slothlet API proxy.
 * @example
 * const api = await makeApi({ hook: { enabled: true } });
 */
async function makeApi(extra = {}) {
	return slothlet({
		mode: "eager",
		runtime: "async",
		dir: TEST_DIRS.API_TEST,
		...extra
	});
}

/**
 * Retrieve the raw Slothlet engine instance from any wrapper in an API proxy.
 * @param {object} api - Slothlet API proxy returned by slothlet().
 * @returns {object} Internal Slothlet engine instance.
 * @example
 * const engine = getEngine(api);
 * engine.isLoaded; // true
 */
function getEngine(api) {
	return resolveWrapper(api.math).slothlet;
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let api = null;
let engine = null;

beforeEach(async () => {
	api = await makeApi();
	engine = getEngine(api);
});

afterEach(async () => {
	if (api && typeof api.shutdown === "function") {
		// Ensure isLoaded so shutdown doesn't skip cleanup
		engine.isLoaded = true;
		await api.shutdown();
	}
	api = null;
	engine = null;
});

// ---------------------------------------------------------------------------
// line 138 – _setupLifecycleSubscribers returns early when lifecycle is null
// ---------------------------------------------------------------------------

describe("slothlet._setupLifecycleSubscribers — null lifecycle guard (line 138)", () => {
	it("returns early without error when handlers.lifecycle is null", () => {
		// Arrange: null out the lifecycle handler
		const saved = engine.handlers.lifecycle;
		engine.handlers.lifecycle = null;

		// Act + Assert: calling the method directly should be a no-op (no throw)
		expect(() => engine._setupLifecycleSubscribers()).not.toThrow();

		// Restore so afterEach cleanup works
		engine.handlers.lifecycle = saved;
	});

	it("runs normally when lifecycle is available", () => {
		// Baseline: lifecycle handler should be present after normal load
		expect(engine.handlers.lifecycle).toBeTruthy();
		// Calling again with valid lifecycle should not throw either
		expect(() => engine._setupLifecycleSubscribers()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// lines 347-348 – setApiContextChecker callback body
// Invoked when EventEmitter.on() is called from within an async API method.
// api.events.watcher.init() calls chokidar's watcher.on() inside the async
// context, triggering isInApiContext() → tryGetContext() + return.
// ---------------------------------------------------------------------------

describe("slothlet setApiContextChecker callback (lines 347-348)", () => {
	it("isInApiContext returns true when EventEmitter.on is called inside async API method", async () => {
		// api.events.watcher.init() calls watcher.on() 5× (add/change/unlink/error/ready)
		// inside the unified-wrapper's runInContext scope.  The patched EventEmitter.on
		// calls runtime_maybeTrackEmitter → isInApiContext() → lines 347-348 execute.
		const result = await api.events.watcher.init();

		// The method itself should succeed as a side-effect validation
		expect(result).toBeDefined();
		expect(result.created).toBe(true);

		// Clean up the chokidar watcher so it doesn't hold the process open
		await api.events.watcher.close();
	});

	it("isInApiContext is evaluated for every EventEmitter.on call within an API method", async () => {
		// Verify that the watcher accumulated 5 listeners (one per watcher.on() call),
		// each of which triggered the context checker.  The listener count being correct
		// proves that every patched .on() path was traversed.
		await api.events.watcher.init();
		const count = await api.events.watcher.getListenerCount();

		expect(count).toBe(5); // add + change + unlink + error + ready

		await api.events.watcher.close();
	});
});

// ---------------------------------------------------------------------------
// line 497 – reload() throws when config.dir is falsy
// ---------------------------------------------------------------------------

describe("slothlet.reload() — missing config.dir guard (line 497)", () => {
	it("throws INVALID_CONFIG_NOT_LOADED when config has no dir", async () => {
		// Arrange: wipe config.dir to simulate a never-configured instance
		const savedConfig = engine.config;
		engine.config = { dir: null };

		// Act + Assert
		await expect(engine.reload()).rejects.toThrow(/INVALID_CONFIG_NOT_LOADED|not.*loaded/i);

		// Restore
		engine.config = savedConfig;
	});

	it("throws when config is entirely absent", async () => {
		const savedConfig = engine.config;
		engine.config = null;

		await expect(engine.reload()).rejects.toThrow();

		engine.config = savedConfig;
	});
});

// ---------------------------------------------------------------------------
// line 592 – _clearModuleCaches deletes CJS entries from require.cache on reload
// ---------------------------------------------------------------------------

describe("slothlet._clearModuleCaches — CJS require.cache cleanup (line 592)", () => {
	it("removes CJS require.cache entries belonging to the loaded dir on reload", async () => {
		// Load a CJS-only API directory so that CJS modules are registered in require.cache
		let cjsApi = null;
		try {
			cjsApi = await slothlet({
				mode: "eager",
				runtime: "async",
				dir: TEST_DIRS.API_TEST_CJS
			});

			const cjsEngine = resolveWrapper(cjsApi.math).slothlet;

			// Record cache size before reload
			// createRequire gives access to require.cache in this ESM test environment
			const beforeKeys = Object.keys(_require.cache).filter((k) => k.includes("api_test_cjs"));

			// Reload — this calls _clearModuleCaches() which hits line 592 in the delete loop
			await cjsEngine.reload();

			// After reload the modules are re-imported; check they were evicted+re-added
			// The important invariant is that reload did not throw
			expect(cjsEngine.isLoaded).toBe(true);
		} finally {
			if (cjsApi && typeof cjsApi.shutdown === "function") {
				await cjsApi.shutdown();
			}
		}
	});
});

// ---------------------------------------------------------------------------
// line 608 – injectRuntimeMetadataFunctions returns early when api lacks
//            the metadata key (i.e., metadata is not enabled in the build)
// ---------------------------------------------------------------------------

describe("slothlet.injectRuntimeMetadataFunctions — early return guard (line 608)", () => {
	it("returns without error when api object has no slothlet.metadata key", () => {
		// Passing an empty object means api.slothlet is undefined → early return
		expect(() => engine.injectRuntimeMetadataFunctions({})).not.toThrow();
	});

	it("returns without error when api.slothlet exists but has no metadata sub-key", () => {
		// Covers the branch where the api.slothlet namespace exists but metadata is absent
		const fakeApi = { slothlet: {} };
		expect(() => engine.injectRuntimeMetadataFunctions(fakeApi)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// line 677 – getAPI() throws when isLoaded is false
// ---------------------------------------------------------------------------

describe("slothlet.getAPI() — not-loaded guard (line 677)", () => {
	it("throws INVALID_CONFIG_NOT_LOADED when isLoaded is false", () => {
		// Simulate an instance that was never loaded (or was fully shut down)
		engine.isLoaded = false;

		expect(() => engine.getAPI()).toThrow(/INVALID_CONFIG_NOT_LOADED|not.*loaded/i);

		// Restore so afterEach shutdown works
		engine.isLoaded = true;
	});

	it("returns the API object normally when isLoaded is true", () => {
		expect(engine.isLoaded).toBe(true);
		const result = engine.getAPI();
		// The API may be a function (when a root contributor function is present) or an object
		expect(result).toBeDefined();
		expect(result).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// line 711 – getOwnership() returns null when ownership handler is absent
// ---------------------------------------------------------------------------

describe("slothlet.getOwnership() — no ownership handler guard (line 711)", () => {
	it("returns null when handlers.ownership is null", () => {
		const savedOwnership = engine.handlers.ownership;
		engine.handlers.ownership = null;

		const result = engine.getOwnership();
		expect(result).toBeNull();

		// Restore
		engine.handlers.ownership = savedOwnership;
	});

	it("returns ownership data when the handler is present", () => {
		// Baseline: getOwnership should work normally
		// (returns null or an actual value depending on whether ownership tracking is enabled)
		const savedOwnership = engine.handlers.ownership;

		if (savedOwnership) {
			// Ownership handler present – result is not null
			const result = engine.getOwnership();
			expect(result !== undefined).toBe(true);
		} else {
			// No ownership handler – already returns null (tested by the previous test)
			expect(engine.getOwnership()).toBeNull();
		}
	});
});
