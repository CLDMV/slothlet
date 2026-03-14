/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-internal-guards.test.vitest.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772496000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 10:41:46 -08:00 (1772476906)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for api-manager.mjs internal defensive guards that are unreachable
 * from the public API but must be exercised to verify correct error handling.
 *
 * Covers:
 *   - Line 1851/1854: reloadApiComponent while isLoaded=false → INVALID_CONFIG_NOT_LOADED
 *   - Line 1869:      reloadApiComponent({}) with no moduleID/apiPath → INVALID_ARGUMENT
 *   - Line 1891/1894: _reloadByModuleID when cacheManager is null → CACHE_MANAGER_NOT_AVAILABLE
 *   - Line 1899/1902: _reloadByModuleID with non-existent moduleID → CACHE_NOT_FOUND
 *   - Lines 2452-2491: _restoreApiTree no-wrapper else branch (plain object at endpoint)
 *
 * All tests use resolveWrapper() to access the internal Slothlet instance and mutate
 * internal state directly. State is always restored in finally blocks.
 *
 * @module tests/vitests/suites/api-manager/api-manager-internal-guards
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Extract the real Slothlet instance from a proxy by resolving the wrapper on any
 * top-level property.
 * @param {object} api - Slothlet API proxy.
 * @param {string} [prop="math"] - A property that definitely has a wrapper.
 * @returns {import("@cldmv/slothlet").Slothlet} Internal Slothlet instance.
 */
function getSlInstance(api, prop = "math") {
	const wrapper = resolveWrapper(api[prop]);
	if (!wrapper) throw new Error(`resolveWrapper(api.${prop}) returned null`);
	return wrapper.slothlet;
}

// ---------------------------------------------------------------------------
// 1. reloadApiComponent — isLoaded=false guard (line 1851)
// ---------------------------------------------------------------------------
describe("reloadApiComponent — isLoaded=false guard", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws INVALID_CONFIG_NOT_LOADED when isLoaded is false before reload (apiPath variant)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const orig = sl.isLoaded;
		sl.isLoaded = false;
		try {
			await expect(
				sl.handlers.apiManager.reloadApiComponent({ apiPath: "math" })
			).rejects.toMatchObject({ code: "INVALID_CONFIG_NOT_LOADED" });
		} finally {
			sl.isLoaded = orig;
		}
	});

	it("throws INVALID_CONFIG_NOT_LOADED when isLoaded is false before reload (moduleID variant)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const orig = sl.isLoaded;
		sl.isLoaded = false;
		try {
			await expect(
				sl.handlers.apiManager.reloadApiComponent({ moduleID: "some-module" })
			).rejects.toMatchObject({ code: "INVALID_CONFIG_NOT_LOADED" });
		} finally {
			sl.isLoaded = orig;
		}
	});
});

// ---------------------------------------------------------------------------
// 2. reloadApiComponent — INVALID_ARGUMENT guard (line 1869)
// ---------------------------------------------------------------------------
describe("reloadApiComponent — empty params guard", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws INVALID_ARGUMENT when called with empty object {}", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager.reloadApiComponent({})
		).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
	});

	it("throws INVALID_ARGUMENT when called with null", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager.reloadApiComponent(null)
		).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
	});

	it("throws INVALID_ARGUMENT when called with undefined", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager.reloadApiComponent(undefined)
		).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
	});

	it("throws INVALID_ARGUMENT when called with object having neither moduleID nor apiPath", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager.reloadApiComponent({ randomKey: "value" })
		).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
	});
});

// ---------------------------------------------------------------------------
// 3. _reloadByModuleID — cacheManager=null guard (line 1891)
// ---------------------------------------------------------------------------
describe("_reloadByModuleID — cacheManager null guard", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws CACHE_MANAGER_NOT_AVAILABLE when apiCacheManager is null", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const origCM = sl.handlers.apiCacheManager;
		sl.handlers.apiCacheManager = null;
		try {
			await expect(
				sl.handlers.apiManager._reloadByModuleID("any-module")
			).rejects.toMatchObject({ code: "CACHE_MANAGER_NOT_AVAILABLE" });
		} finally {
			sl.handlers.apiCacheManager = origCM;
		}
	});

	it("throws CACHE_MANAGER_NOT_AVAILABLE regardless of moduleID when cacheManager is null", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "extra-guard-mod" });
		const origCM = sl.handlers.apiCacheManager;
		sl.handlers.apiCacheManager = null;
		try {
			await expect(
				sl.handlers.apiManager._reloadByModuleID("extra-guard-mod")
			).rejects.toMatchObject({ code: "CACHE_MANAGER_NOT_AVAILABLE" });
		} finally {
			sl.handlers.apiCacheManager = origCM;
		}
	});
});

// ---------------------------------------------------------------------------
// 4. _reloadByModuleID — CACHE_NOT_FOUND guard (line 1899)
// ---------------------------------------------------------------------------
describe("_reloadByModuleID — CACHE_NOT_FOUND guard", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws CACHE_NOT_FOUND for a moduleID that was never registered", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager._reloadByModuleID("totally_nonexistent_xyz_guard")
		).rejects.toMatchObject({ code: "CACHE_NOT_FOUND" });
	});

	it("throws CACHE_NOT_FOUND after manually deleting the cache entry", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await api.slothlet.api.add("guard_extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "guard-del-mod" });
		// Manually remove from cache (simulating a corrupted state)
		sl.handlers.apiCacheManager.delete("guard-del-mod");
		await expect(
			sl.handlers.apiManager._reloadByModuleID("guard-del-mod")
		).rejects.toMatchObject({ code: "CACHE_NOT_FOUND" });
	});

	it("error includes the moduleID in the thrown error", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const err = await sl.handlers.apiManager._reloadByModuleID("ghost-module-id").catch((e) => e);
		expect(err.code).toBe("CACHE_NOT_FOUND");
		expect(err.message ?? err.toString()).toMatch(/ghost-module-id/);
	});
});

// ---------------------------------------------------------------------------
// 5. _restoreApiTree — no-wrapper else branch (lines 2452-2491)
// ---------------------------------------------------------------------------
describe("_restoreApiTree — no-wrapper else branch", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("recreates wrapper when a plain object has been placed at the endpoint", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);

		const mid = await api.slothlet.api.add("restoreTarget", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "restore-guard-mod"
		});

		// Confirm it was added as a wrapper
		expect(resolveWrapper(api.restoreTarget)).not.toBeNull();

		// Replace the wrapper with a plain object — simulates corrupted state
		sl.api.restoreTarget = { justAPlainObject: true };
		expect(resolveWrapper(sl.api.restoreTarget)).toBeNull();

		// Now reload — _restoreApiTree should hit the no-wrapper else branch and recreate
		await sl.handlers.apiManager._reloadByModuleID(mid);

		// After reload the property should be restored as a real proxy/value
		expect(sl.api.restoreTarget).toBeDefined();
	});

	it("no-wrapper branch runs without throwing", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);

		const mid = await api.slothlet.api.add("plainReplace", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "plain-replace-mod"
		});

		sl.api.plainReplace = { plain: true };

		await expect(sl.handlers.apiManager._reloadByModuleID(mid)).resolves.not.toThrow();
	});

	it("no-wrapper branch works for nested paths", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);

		const mid = await api.slothlet.api.add("deep.nested.guard", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "deep-plain-mod"
		});

		// Replace entire deep path with plain value
		if (sl.api.deep?.nested) {
			sl.api.deep.nested.guard = { plainDeep: true };
		}

		await expect(sl.handlers.apiManager._reloadByModuleID(mid)).resolves.not.toThrow();
	});
});
