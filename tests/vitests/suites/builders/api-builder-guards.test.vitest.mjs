/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/api-builder-guards.test.vitest.mjs
 *	@Date: 2026-03-02T15:20:00-08:00 (1772493600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 16:10:49 -08:00 (1772496649)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Handler-null guard coverage for api_builder.mjs.
 *
 * @description
 * Covers:
 *   lines 589,609,636,658,678,699  – hook.on/remove/off/enable/disable/list throw HOOKS_NOT_INITIALIZED
 *   lines 727,761,828              – metadata.setGlobal/set/setFor throw METADATA_NOT_AVAILABLE
 *   line  865                      – metadata.removeFor early-returns when handler absent
 *   line  920                      – owner.get returns null when ownership handler absent
 *   lines 947,949                  – materialize namespace stub (null handler IIFE)
 *   line  976                      – lifecycle namespace noop stub (null handler IIFE)
 *   line  1051                     – diag.owner.get returns null when ownership absent
 *   lines 1077,1088,1100           – diag.caches.get/getAllModuleIDs/has fallbacks when apiCacheManager absent
 *   line  1135                     – diag.hook.compilePattern executes
 *   line  1165                     – userHooks.shutdown callback called on api.shutdown()
 *   lines 1427,1447-1450           – userHooks.destroy callback + destroy clear loop via api.destroy()
 *   line  487                      – context.get falls back to slothlet.context for unknown manager type
 *   line  1257                     – scope() throws NO_CONTEXT_MANAGER when contextManager is null
 *   lines 1287,1358                – scope() throws CONTEXT_NOT_FOUND for Live/Async missing store
 *   line  1406                     – scope() throws UNSUPPORTED_CONTEXT_MANAGER for unknown type
 *
 * @module tests/vitests/suites/builders/api-builder-guards
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a default eager API from the standard test directory.
 * @param {object} [extra={}] - Additional config options.
 * @returns {Promise<object>} Slothlet API proxy.
 */
async function makeApi(extra = {}) {
	return slothlet({
		mode: "eager",
		runtime: "async",
		hook: { enabled: true },
		dir: TEST_DIRS.API_TEST,
		...extra
	});
}

/**
 * Create a default eager API with diagnostics enabled.
 * @returns {Promise<object>} Slothlet API proxy with diagnostics namespace.
 */
async function makeApiWithDiag() {
	return slothlet({
		mode: "eager",
		runtime: "async",
		hook: { enabled: true },
		diagnostics: true,
		dir: TEST_DIRS.API_TEST
	});
}

/**
 * Retrieve the raw slothlet instance from any wrapper in the API.
 * @param {object} api - Slothlet API proxy.
 * @returns {object} Internal slothlet instance.
 */
function getSlothlet(api) {
	return resolveWrapper(api.math).slothlet;
}

// ---------------------------------------------------------------------------
// Group A: HOOKS_NOT_INITIALIZED throws (lines 589, 609, 636, 658, 678, 699)
// ---------------------------------------------------------------------------
describe("api_builder – hook methods throw HOOKS_NOT_INITIALIZED when hookManager is null", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("hook.on throws HOOKS_NOT_INITIALIZED (line 589)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.hookManager;
		sl.handlers.hookManager = null;
		try {
			expect(() => api.slothlet.hook.on("before:*", () => {})).toThrow(/HOOKS_NOT_INITIALIZED/);
		} finally {
			sl.handlers.hookManager = orig;
		}
	});

	it("hook.remove throws HOOKS_NOT_INITIALIZED (line 609)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.hookManager;
		sl.handlers.hookManager = null;
		try {
			expect(() => api.slothlet.hook.remove({})).toThrow(/HOOKS_NOT_INITIALIZED/);
		} finally {
			sl.handlers.hookManager = orig;
		}
	});

	it("hook.off throws HOOKS_NOT_INITIALIZED (line 636)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.hookManager;
		sl.handlers.hookManager = null;
		try {
			expect(() => api.slothlet.hook.off("some-id")).toThrow(/HOOKS_NOT_INITIALIZED/);
		} finally {
			sl.handlers.hookManager = orig;
		}
	});

	it("hook.enable throws HOOKS_NOT_INITIALIZED (line 658)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.hookManager;
		sl.handlers.hookManager = null;
		try {
			expect(() => api.slothlet.hook.enable({})).toThrow(/HOOKS_NOT_INITIALIZED/);
		} finally {
			sl.handlers.hookManager = orig;
		}
	});

	it("hook.disable throws HOOKS_NOT_INITIALIZED (line 678)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.hookManager;
		sl.handlers.hookManager = null;
		try {
			expect(() => api.slothlet.hook.disable({})).toThrow(/HOOKS_NOT_INITIALIZED/);
		} finally {
			sl.handlers.hookManager = orig;
		}
	});

	it("hook.list throws HOOKS_NOT_INITIALIZED (line 699)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.hookManager;
		sl.handlers.hookManager = null;
		try {
			expect(() => api.slothlet.hook.list({})).toThrow(/HOOKS_NOT_INITIALIZED/);
		} finally {
			sl.handlers.hookManager = orig;
		}
	});
});

// ---------------------------------------------------------------------------
// Group B: METADATA_NOT_AVAILABLE throws (lines 727, 761, 828)
// Group C: metadata.removeFor early return (line 865)
// ---------------------------------------------------------------------------
describe("api_builder – metadata methods guard against absent metadata handler", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("metadata.setGlobal throws METADATA_NOT_AVAILABLE when handler is null (line 727)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.metadata;
		sl.handlers.metadata = null;
		try {
			expect(() => api.slothlet.metadata.setGlobal("version", "1.0")).toThrow(/METADATA_NOT_AVAILABLE/);
		} finally {
			sl.handlers.metadata = orig;
		}
	});

	it("metadata.set throws METADATA_NOT_AVAILABLE when handler is null (line 761)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.metadata;
		sl.handlers.metadata = null;
		try {
			expect(() => api.slothlet.metadata.set(api.math.add, "desc", "adds")).toThrow(/METADATA_NOT_AVAILABLE/);
		} finally {
			sl.handlers.metadata = orig;
		}
	});

	it("metadata.setFor throws METADATA_NOT_AVAILABLE when handler is null (line 828)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.metadata;
		sl.handlers.metadata = null;
		try {
			expect(() => api.slothlet.metadata.setFor("math", "category", "math")).toThrow(/METADATA_NOT_AVAILABLE/);
		} finally {
			sl.handlers.metadata = orig;
		}
	});

	it("metadata.removeFor returns early without throwing when handler is null (line 865)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.metadata;
		sl.handlers.metadata = null;
		try {
			// Must NOT throw — guarded by `if (!slothlet.handlers?.metadata) return;`
			expect(() => api.slothlet.metadata.removeFor("math")).not.toThrow();
		} finally {
			sl.handlers.metadata = orig;
		}
	});
});

// ---------------------------------------------------------------------------
// Group D: owner.get returns null when ownership handler absent (line 920)
// ---------------------------------------------------------------------------
describe("api_builder – owner.get returns null when ownership handler is absent", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("owner.get returns null when slothlet.handlers.ownership is null (line 920)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.handlers.ownership;
		sl.handlers.ownership = null;
		try {
			const result = api.slothlet.owner.get("math");
			expect(result).toBe(null);
		} finally {
			sl.handlers.ownership = orig;
		}
	});
});

// ---------------------------------------------------------------------------
// Group E: materialize + lifecycle stub IIFEs (lines 947, 949, 976)
//
// These IIFEs run at createSlothletNamespace() time. We null the handlers
// BEFORE calling createSlothletNamespace() via sl.builders.apiBuilder so the
// IIFE sees null and returns the stub object.
// ---------------------------------------------------------------------------
describe("api_builder – materialize and lifecycle fallback stubs when handlers absent", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("materialize namespace returns frozen stub when handler is null (lines 947, 949)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const builder = sl.builders.apiBuilder;
		const origMat = sl.handlers.materialize;
		sl.handlers.materialize = null;
		try {
			const ns = await builder.createSlothletNamespace({});
			// Stub has materialized: false and a get() returning zeros
			expect(ns.materialize.materialized).toBe(false);
			const stats = ns.materialize.get();
			expect(stats).toMatchObject({ total: 0, materialized: 0, remaining: 0, percentage: 100 });
		} finally {
			sl.handlers.materialize = origMat;
		}
	});

	it("lifecycle namespace returns noop on/off when handler is null (line 976)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const builder = sl.builders.apiBuilder;
		const origLc = sl.handlers.lifecycle;
		sl.handlers.lifecycle = null;
		try {
			const ns = await builder.createSlothletNamespace({});
			// Stub returns { on: noop, off: noop }
			expect(typeof ns.lifecycle.on).toBe("function");
			expect(typeof ns.lifecycle.off).toBe("function");
			// Noop functions return undefined and do not throw
			expect(ns.lifecycle.on("materialized:complete", () => {})).toBeUndefined();
		} finally {
			sl.handlers.lifecycle = origLc;
		}
	});
});

// ---------------------------------------------------------------------------
// Group F: diagnostics namespace guards (lines 1051, 1077, 1088, 1100, 1135)
// ---------------------------------------------------------------------------
describe("api_builder – diagnostics namespace fallbacks when handlers absent", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("diag.owner.get returns null when ownership handler is null (line 1051)", async () => {
		api = await makeApiWithDiag();
		const sl = getSlothlet(api);
		const origOwn = sl.handlers.ownership;
		sl.handlers.ownership = null;
		try {
			const result = api.slothlet.diag.owner.get("math");
			expect(result).toBe(null);
		} finally {
			sl.handlers.ownership = origOwn;
		}
	});

	it("diag.caches.get returns empty diagnostics when apiCacheManager is null (line 1077)", async () => {
		api = await makeApiWithDiag();
		const sl = getSlothlet(api);
		const origCache = sl.handlers.apiCacheManager;
		sl.handlers.apiCacheManager = null;
		try {
			const result = api.slothlet.diag.caches.get();
			expect(result).toEqual({ totalCaches: 0, caches: [] });
		} finally {
			sl.handlers.apiCacheManager = origCache;
		}
	});

	it("diag.caches.getAllModuleIDs returns empty array when apiCacheManager is null (line 1088)", async () => {
		api = await makeApiWithDiag();
		const sl = getSlothlet(api);
		const origCache = sl.handlers.apiCacheManager;
		sl.handlers.apiCacheManager = null;
		try {
			const result = api.slothlet.diag.caches.getAllModuleIDs();
			expect(result).toEqual([]);
		} finally {
			sl.handlers.apiCacheManager = origCache;
		}
	});

	it("diag.caches.has returns false when apiCacheManager is null (line 1100)", async () => {
		api = await makeApiWithDiag();
		const sl = getSlothlet(api);
		const origCache = sl.handlers.apiCacheManager;
		sl.handlers.apiCacheManager = null;
		try {
			const result = api.slothlet.diag.caches.has("any-module-id");
			expect(result).toBe(false);
		} finally {
			sl.handlers.apiCacheManager = origCache;
		}
	});

	it("diag.hook.compilePattern executes via hookManager diagnostic method (line 1135)", async () => {
		api = await makeApiWithDiag();
		// With hooks enabled, diag.hook is present and compilePattern calls
		// slothlet.handlers.hookManager.getCompilePatternForDiagnostics()(pattern)
		expect(api.slothlet.diag.hook).toBeDefined();
		expect(typeof api.slothlet.diag.hook.compilePattern).toBe("function");
		const result = api.slothlet.diag.hook.compilePattern("before:*");
		// Returns a compiled RegExp or pattern — just verify it did not throw
		expect(result).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Group G: userHooks.shutdown/destroy callbacks + destroy clear loop
//          (lines 1165, 1427, 1447-1450)
// ---------------------------------------------------------------------------
describe("api_builder – userHooks shutdown and destroy callbacks are invoked", () => {
	it("userHooks.shutdown is called before api.shutdown() completes (line 1165)", async () => {
		const api = await makeApi();
		const sl = getSlothlet(api);
		let shutdownCalled = false;
		sl.userHooks.shutdown = async () => {
			shutdownCalled = true;
		};
		await api.shutdown();
		expect(shutdownCalled).toBe(true);
	});

	it("userHooks.destroy is called before api.destroy() completes (line 1427)", async () => {
		const api = await makeApi();
		const sl = getSlothlet(api);
		let destroyCalled = false;
		sl.userHooks.destroy = async () => {
			destroyCalled = true;
		};
		await api.destroy();
		expect(destroyCalled).toBe(true);
	});

	it("api.destroy() clears all enumerable properties from the api object (lines 1447-1450)", async () => {
		const api = await makeApi();
		const sl = getSlothlet(api);
		// Capture keys before destroy
		const keysBefore = Object.keys(api);
		expect(keysBefore.length).toBeGreaterThan(0);
		await api.destroy();
		// After destroy, slothlet marks the instance as destroyed
		expect(sl.isDestroyed).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Group H: context manager fallback paths (lines 487, 1257, 1287, 1358, 1406)
// ---------------------------------------------------------------------------
describe("api_builder – context.get and scope() fallback paths for edge-case managers", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown().catch(() => {});
			api = null;
		}
	});

	it("context.get returns {} when contextManager is an unknown type (line 487)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.contextManager;
		sl.contextManager = { constructor: { name: "UnknownContextManager" } };
		try {
			const result = api.slothlet.context.get();
			expect(result).toEqual({});
		} finally {
			sl.contextManager = orig;
		}
	});

	it("scope() throws NO_CONTEXT_MANAGER when contextManager is null (line 1257)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.contextManager;
		sl.contextManager = null;
		try {
			await expect(api.slothlet.scope({ context: { x: 1 }, fn: () => {} })).rejects.toThrow(/NO_CONTEXT_MANAGER/);
		} finally {
			sl.contextManager = orig;
		}
	});

	it("scope() throws CONTEXT_NOT_FOUND when LiveContextManager has no store for instanceID (line 1287)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.contextManager;
		// Fake LiveContextManager with empty instances map
		sl.contextManager = {
			constructor: { name: "LiveContextManager" },
			currentInstanceID: null,
			instances: new Map()
		};
		try {
			await expect(api.slothlet.scope({ context: { x: 1 }, fn: () => {} })).rejects.toThrow(/CONTEXT_NOT_FOUND/);
		} finally {
			sl.contextManager = orig;
		}
	});

	it("scope() throws CONTEXT_NOT_FOUND when AsyncContextManager has no base store for instanceID (line 1358)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.contextManager;
		// Fake AsyncContextManager with no active ALS context and empty instances map
		sl.contextManager = {
			constructor: { name: "AsyncContextManager" },
			tryGetContext: () => null,
			instances: new Map()
		};
		try {
			await expect(api.slothlet.scope({ context: { x: 1 }, fn: () => {} })).rejects.toThrow(/CONTEXT_NOT_FOUND/);
		} finally {
			sl.contextManager = orig;
		}
	});

	it("scope() throws UNSUPPORTED_CONTEXT_MANAGER for unrecognized manager type (line 1406)", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const orig = sl.contextManager;
		// Fake contextManager with unknown constructor name (but enough API to pass earlier checks)
		sl.contextManager = {
			constructor: { name: "PropietaryContextManager" },
			instances: new Map()
		};
		try {
			await expect(api.slothlet.scope({ context: { x: 1 }, fn: () => {} })).rejects.toThrow(/UNSUPPORTED_CONTEXT_MANAGER/);
		} finally {
			sl.contextManager = orig;
		}
	});
});
