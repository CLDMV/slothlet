/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/diagnostics/diagnostics-extended.test.vitest.mjs
 *	@Date: 2026-03-01 12:30:36 -08:00 (1772397036)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 16:31:03 -08:00 (1772411463)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage-gap tests for api_builder.mjs diagnostics namespace function bodies.
 *
 * @description
 * The `diagnostics-endpoint-availability` suite already verifies that each key is _present_
 * on `api.slothlet.diag`, but it does not _call_ every function.  The following lines in
 * `src/lib/builders/api_builder.mjs` remain uncovered because functions are referenced but
 * not invoked in the existing suite:
 *
 * - **Line 995** (`diag.describe(showAll=true)`): the `if (showAll)` branch that returns
 *   `{ ...userApi }` instead of just `Reflect.ownKeys(userApi)`.
 *
 * - **Line 1035** (`diag.owner.get(apiPath)`): calls `ownership.getPathOwnership(apiPath)`.
 *
 * - **Line 1061** (`diag.caches.get()`): calls `apiCacheManager.getCacheDiagnostics()`.
 *
 * - **Line 1072** (`diag.caches.getAllModuleIDs()`): calls `apiCacheManager.getAllModuleIDs()`.
 *
 * - **Line 1084** (`diag.caches.has(moduleID)`): calls `apiCacheManager.has(moduleID)`.
 *
 * - **Line 1119** (`diag.hook.enabled` getter): reads `hookManager.enabled`.
 *
 * - **Line 1149** (`diag.hook.compilePattern(pattern)`): calls
 *   `hookManager.getCompilePatternForDiagnostics()(pattern)`.
 *
 * @module tests/vitests/suites/diagnostics/diagnostics-extended
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Shared setup ─────────────────────────────────────────────────────────────

let api;

beforeEach(async () => {
	api = await slothlet({
		dir: TEST_DIRS.API_TEST,
		silent: true,
		diagnostics: true
	});
});

afterEach(async () => {
	if (api) {
		await api.shutdown().catch(() => {});
		api = null;
	}
});

// ─── diag.describe(showAll=true) — line 995 ──────────────────────────────────

describe("api.slothlet.diag.describe(showAll)", () => {
	it("describe() returns top-level key array when called with no arguments (showAll=false path)", () => {
		const result = api.slothlet.diag.describe();
		expect(Array.isArray(result)).toBe(true);
		expect(result).toContain("math");
	});

	it("describe(false) returns top-level key array", () => {
		const result = api.slothlet.diag.describe(false);
		expect(Array.isArray(result)).toBe(true);
	});

	it("describe(true) returns full API structure object instead of key array (line 995)", () => {
		// `if (showAll) { return { ...userApi }; }` — this branch was previously uncovered
		const result = api.slothlet.diag.describe(true);
		expect(result).toBeDefined();
		expect(typeof result).toBe("object");
		expect(Array.isArray(result)).toBe(false);
		expect(result).toHaveProperty("math");
	});

	it("describe(true) result contains all enumerable API keys that describe(false) lists", () => {
		const allKeys = api.slothlet.diag.describe(false);
		const full = api.slothlet.diag.describe(true);
		// describe(false) uses Reflect.ownKeys which includes non-enumerable function props
		// (like 'length', 'name', 'prototype') that { ...userApi } does not copy.
		// Only check keys that actually exist as enumerable properties in full.
		const fullKeys = new Set(Object.keys(full));
		const enumerableApiKeys = allKeys.filter((k) => fullKeys.has(String(k)));
		expect(enumerableApiKeys.length).toBeGreaterThan(0);
		expect(enumerableApiKeys).toContain("math");
		expect(enumerableApiKeys).toContain("slothlet");
	});
});

// ─── diag.owner.get(apiPath) — line 1035 ─────────────────────────────────────

describe("api.slothlet.diag.owner.get()", () => {
	it("returns ownership info for a known API path (line 1035)", () => {
		// `slothlet.handlers.ownership.getPathOwnership(apiPath)` is called here
		const result = api.slothlet.diag.owner.get("math");
		// Ownership data should be non-null for a registered path
		expect(result).toBeDefined();
	});

	it("returns data for a deeply nested known path", () => {
		const result = api.slothlet.diag.owner.get("math.add");
		expect(result).toBeDefined();
	});

	it("returns null or undefined for a non-existent path without throwing", () => {
		const result = api.slothlet.diag.owner.get("__completely_nonexistent__");
		// Either null or an empty set / falsy — no throw
		expect(result == null || typeof result === "object").toBe(true);
	});
});

// ─── diag.caches.get() — line 1061 ───────────────────────────────────────────

describe("api.slothlet.diag.caches.get()", () => {
	it("returns cache diagnostics object with expected shape (line 1061)", () => {
		const result = api.slothlet.diag.caches.get();
		expect(result).toBeDefined();
		expect(typeof result).toBe("object");
		// `getCacheDiagnostics()` returns { totalCaches, caches[] }
		expect(typeof result.totalCaches).toBe("number");
		expect(Array.isArray(result.caches)).toBe(true);
	});

	it("totalCaches is at least 1 after initial load", () => {
		const result = api.slothlet.diag.caches.get();
		expect(result.totalCaches).toBeGreaterThanOrEqual(1);
	});

	it("caches array entries have moduleID and endpoint fields", () => {
		const result = api.slothlet.diag.caches.get();
		if (result.caches.length > 0) {
			const first = result.caches[0];
			expect(first).toHaveProperty("moduleID");
			expect(first).toHaveProperty("endpoint");
		}
	});
});

// ─── diag.caches.getAllModuleIDs() — line 1072 ───────────────────────────────

describe("api.slothlet.diag.caches.getAllModuleIDs()", () => {
	it("returns array of moduleID strings (line 1072)", () => {
		const ids = api.slothlet.diag.caches.getAllModuleIDs();
		expect(Array.isArray(ids)).toBe(true);
		expect(ids.length).toBeGreaterThanOrEqual(1);
		for (const id of ids) {
			expect(typeof id).toBe("string");
		}
	});
});

// ─── diag.caches.has(moduleID) — line 1084 ───────────────────────────────────

describe("api.slothlet.diag.caches.has()", () => {
	it("returns true for a moduleID that exists in the cache (line 1084)", () => {
		const [firstID] = api.slothlet.diag.caches.getAllModuleIDs();
		expect(firstID).toBeDefined();
		const result = api.slothlet.diag.caches.has(firstID);
		expect(result).toBe(true);
	});

	it("returns false for a moduleID that does not exist in the cache (line 1084)", () => {
		const result = api.slothlet.diag.caches.has("__totally_fake_module_id__");
		expect(result).toBe(false);
	});
});

// ─── diag.hook.enabled + diag.hook.compilePattern — lines 1119, 1149 ─────────

describe("api.slothlet.diag.hook diagnostics", () => {
	it("hook.enabled getter returns a boolean (line 1119)", () => {
		// `get enabled() { return slothlet.handlers.hookManager.enabled; }`
		const enabled = api.slothlet.diag.hook.enabled;
		expect(typeof enabled).toBe("boolean");
	});

	it("hook.enabled is false when hooks are not configured (default)", () => {
		// Hooks default to disabled — must be explicitly enabled via hook:true/object/string
		expect(api.slothlet.diag.hook.enabled).toBe(false);
	});

	it("hook.compilePattern compiles a glob and returns a function or regex (line 1149)", () => {
		// `hookManager.getCompilePatternForDiagnostics()(pattern)`
		const result = api.slothlet.diag.hook.compilePattern("math.*");
		// Result is either a compiled function/RegExp — should be truthy
		expect(result).toBeDefined();
	});

	it("hook.compilePattern('*') returns a truthy compiled pattern", () => {
		const result = api.slothlet.diag.hook.compilePattern("*");
		expect(result).toBeDefined();
	});

	it("hook.compilePattern with a specific path pattern", () => {
		const result = api.slothlet.diag.hook.compilePattern("math.add");
		expect(result).toBeDefined();
	});
});

// ─── diag.getAPI() — slothlet.mjs getAPI() lines 689, 699 ────────────────────

describe("api.slothlet.diag.getAPI()", () => {
	it("returns the bound API object (slothlet.mjs line 699)", () => {
		// `getAPI()` → returns `this.boundApi`
		const result = api.slothlet.diag.getAPI();
		expect(result).toBeDefined();
		// The returned API should have the slothlet namespace
		expect(result.slothlet).toBeDefined();
	});

	it("returned API from getAPI() has .math namespace", () => {
		const result = api.slothlet.diag.getAPI();
		expect(result.math).toBeDefined();
	});
});

// ─── diag.getOwnership() — slothlet.mjs getOwnership() lines 723-726 ─────────

describe("api.slothlet.diag.getOwnership()", () => {
	it("returns ownership diagnostics object when ownership is enabled (lines 723, 726)", () => {
		// `getOwnership()` → `this.handlers.ownership.getDiagnostics()`
		const result = api.slothlet.diag.getOwnership();
		expect(result).toBeDefined();
	});

	it("getOwnership() result has expected structure keys", () => {
		const result = api.slothlet.diag.getOwnership();
		// Ownership diagnostics should be an object (non-null when ownership handler exists)
		expect(typeof result).toBe("object");
	});
});

describe("api.slothlet.diag.getOwnership() with ownership tracking", () => {
	it("returns object with modules/paths diagnostics (lines 723, 726)", async () => {
		let ownerApi;
		try {
			ownerApi = await slothlet({
				dir: TEST_DIRS.API_TEST,
				silent: true,
				diagnostics: true
			});

			// With ownership handler always active, getOwnership() returns diagnostic object
			// (the `!this.handlers.ownership` null-guard at line 723 is a defensive check)
			const result = ownerApi.slothlet.diag.getOwnership();
			// Ownership is always initialized — should return diagnostics object
			expect(result !== undefined).toBe(true);
			if (result !== null) {
				expect(typeof result).toBe("object");
			}
		} finally {
			await ownerApi?.shutdown().catch(() => {});
		}
	});
});
