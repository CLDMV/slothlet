/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/slothlet-debug-flags.test.vitest.mjs
 *	@Date: 2026-03-01 12:28:40 -08:00 (1772396920)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 16:31:02 -08:00 (1772411462)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage-gap tests for slothlet.mjs debug flags and boundApi proxy traps.
 *
 * @description
 * Targets the following uncovered lines in slothlet.mjs:
 *
 * - **Lines 123-128, 133-139** (`debug.initialization`): logged when each handler class is
 *   instantiated during `_initializeComponents()`. Triggered by passing `debug: { initialization: true }`.
 *
 * - **Lines 245-249, 262-267, 275-278** (`debug.materialize`): logged when lazy wrappers are
 *   registered, materialized, and fully resolved in `_registerLazyWrapper()`,
 *   `_onWrapperMaterialized()`, and `_materializationComplete`. Triggered by passing
 *   `debug: { materialize: true }` with lazy mode and accessing a lazy-wrapped API property.
 *
 * - **Line 453** (`boundApi` `has` trap): fired when `prop in api` is evaluated against the
 *   top-level bound-API proxy.
 *
 * - **Line 455** (`boundApi` `ownKeys` trap): fired by `Reflect.ownKeys(api)` /
 *   `Object.keys(api)` against the same proxy.
 *
 * @module tests/vitests/suites/core/slothlet-debug-flags
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Shared teardown ──────────────────────────────────────────────────────────

let api;

afterEach(async () => {
	if (api) {
		await api.shutdown().catch(() => {});
		api = null;
	}
});

// ─── debug.initialization (slothlet.mjs lines 123-128, 133-139) ─────────────
//
// With the fix: debugLogger is now initialised with the RAW config BEFORE
// `_initializeComponents()` runs, so `this.debug("initialization", {...})` inside
// that method can actually emit console output.

describe("debug.initialization flag", () => {
	it("logs DEBUG_MODE_COMPONENT_INITIALIZED for each handler when debug.initialization=true (lines 123-128, 133-139)", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				silent: true,
				debug: { initialization: true }
			});

			// debugLogger is initialised with raw config before _initializeComponents,
			// so the if-body at lines 124-128 now produces actual console output.
			const calls = consoleSpy.mock.calls.map((c) => String(c[0]));
			const initLogs = calls.filter((msg) => msg.includes("[DEBUG:INITIALIZATION]"));
			expect(initLogs.length).toBeGreaterThan(0);
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("does not log initialization messages when debug.initialization is absent", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

			const calls = consoleSpy.mock.calls.map((c) => String(c[0]));
			const initLogs = calls.filter((msg) => msg.includes("[DEBUG:INITIALIZATION]"));
			expect(initLogs.length).toBe(0);
		} finally {
			consoleSpy.mockRestore();
		}
	});
});

// ─── debug.materialize (slothlet.mjs lines 245-249, 262-267, 275-278) ────────

describe("debug.materialize flag", () => {
	it("logs lazy wrapper registration + materialization when debug.materialize=true (lazy mode)", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				silent: true,
				debug: { materialize: true },
				collision: { initial: "replace", api: "replace" }
			});

			// Capture everything that fired during load. normalizeDebug now preserves
			// `materialize: true`, and debugLogger is set before _registerLazyWrapper runs,
			// so both "Lazy wrapper registered" (lines 245-249) and at least one
			// "Lazy wrapper materialized" (lines 262-267) appear inside await slothlet().
			const allLoadCalls = consoleSpy.mock.calls.map((c) => String(c[0]));

			// Lines 245-249: _registerLazyWrapper logs "Lazy wrapper registered"
			const registeredLogs = allLoadCalls.filter((msg) => msg.includes("Lazy wrapper registered"));
			expect(registeredLogs.length).toBeGreaterThan(0);

			// Lines 262-267: _onWrapperMaterialized logs "Lazy wrapper materialized"
			// At least the slothlet-control wrapper materialises during load setup.
			const materializedLogs = allLoadCalls.filter((msg) => msg.includes("Lazy wrapper materialized"));
			expect(materializedLogs.length).toBeGreaterThan(0);
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("does not produce materialize logs in eager mode even if debug.materialize=true", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "eager",
				silent: true,
				debug: { materialize: true }
			});

			// In eager mode, no lazy wrappers are registered so no materialize logs should appear
			const calls = consoleSpy.mock.calls.map((c) => String(c[0]));
			const matLogs = calls.filter((msg) => msg.includes("[DEBUG:MATERIALIZE]"));
			expect(matLogs.length).toBe(0);
		} finally {
			consoleSpy.mockRestore();
		}
	});
});

// ─── boundApi proxy has / ownKeys traps (lines 453, 455) ─────────────────────

describe("boundApi proxy has and ownKeys traps", () => {
	beforeEach(async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
	});

	it("'in' operator triggers the has trap and returns true for known top-level keys (line 453)", () => {
		// The `has` trap: `(target, prop) => (this.api ? prop in this.api : false)`
		expect("slothlet" in api).toBe(true);
		expect("math" in api).toBe(true);
		expect("__nonExistentKey__" in api).toBe(false);
	});

	it("Object.keys() triggers the ownKeys trap and returns the API shape (line 455)", () => {
		// The `ownKeys` trap: `(target) => (this.api ? Reflect.ownKeys(this.api) : [])`
		const keys = Object.keys(api);
		expect(Array.isArray(keys)).toBe(true);
		expect(keys).toContain("slothlet");
		expect(keys.length).toBeGreaterThan(0);
	});

	it("Reflect.ownKeys() also triggers the ownKeys trap (line 455)", () => {
		const keys = Reflect.ownKeys(api);
		expect(Array.isArray(keys)).toBe(true);
		expect(keys.length).toBeGreaterThan(0);
	});
});
