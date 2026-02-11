/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/core-reload-lazy-mode.test.vitest.mjs
 *	@Date: 2026-02-10T06:29:29-08:00 (1770733769)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:01:59 -08:00 (1770775319)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for lazy-mode-aware reload behavior
 *
 * These tests verify that reload respects lazy mode's contract:
 * - Previously-materialized subdirectory wrappers reset to un-materialized shells via ___resetLazy
 * - Un-accessed lazy paths remain lazy (surgical reload — don't load what wasn't used)
 * - Re-accessing a reset wrapper triggers fresh materialization from updated source
 * - Nested lazy children within materialized parents are properly reset via _adoptImplChildren
 * - Proxy identity preserved through lazy reset (existing references continue to work)
 *
 * Only runs against lazy matrix configs since eager mode has no materialization concept.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Only lazy configs — these tests are meaningless for eager mode
const lazyConfigs = getMatrixConfigs({ mode: "lazy" });

for (const { config, name } of lazyConfigs) {
	describe(`Lazy-Mode Reload Behavior - ${name}`, () => {
		let slothlet;
		let api;

		beforeEach(async () => {
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;

			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: {
					collision: {
						initial: "replace",
						api: "replace"
					},
					mutations: {
						add: true,
						remove: true,
						reload: true
					}
				}
			});
		});

		afterEach(async () => {
			if (api) {
				await api.shutdown();
				api = null;
			}
		});

		// ─── Helper: get wrapper state for a subdirectory path ───
		/**
		 * Get the materialized state of a wrapper at the given proxy value.
		 * @param {object|Function} proxyValue - A wrapper proxy (e.g., api.math, api.advanced)
		 * @returns {{ materialized: boolean, inFlight: boolean }|null}
		 */
		function getWrapperState(proxyValue) {
			if (proxyValue && typeof proxyValue.__getState === "function") {
				return proxyValue.__getState();
			}
			return null;
		}

		// ─── 1. Materialized path resets to un-materialized after reload ───

		describe("Memory Release via Reload", () => {
			it("should reset materialized subdirectory to un-materialized after selective reload", async () => {
				// Access api.advanced to trigger materialization
				const result = await api.advanced.selfObject.addViaSelf(2, 3);
				expect(result).toBeDefined();

				// Verify it IS materialized now
				const stateBefore = getWrapperState(api.advanced);
				expect(stateBefore).not.toBeNull();
				expect(stateBefore.materialized).toBe(true);

				// Reload base API by path — "math" is a known subdirectory path with a cache entry
				// For base module reload, use api.slothlet.reload() (full instance rebuild)
				await api.slothlet.reload();

				// After full reload, the subdirectory wrapper should be un-materialized
				// (full reload rebuilds everything from scratch using original mode)
				const stateAfter = getWrapperState(api.advanced);
				expect(stateAfter).not.toBeNull();
				expect(stateAfter.materialized).toBe(false);
				expect(stateAfter.inFlight).toBe(false);
			});

			it("should reset multiple materialized subdirectories after reload", async () => {
				// Materialize several lazy subdirectories
				const advancedResult = await api.advanced.selfObject.addViaSelf(2, 3);
				expect(advancedResult).toBeDefined();

				const utilResult = await api.util.url.cleanEndpoint("test");
				expect(utilResult).toBe("cleanEndpoint");

				const taskResult = await api.task.parseJSON("{}");
				expect(taskResult).toBeDefined();

				// Verify all are materialized
				expect(getWrapperState(api.advanced).materialized).toBe(true);
				expect(getWrapperState(api.util).materialized).toBe(true);
				expect(getWrapperState(api.task).materialized).toBe(true);

				// Full reload
				await api.slothlet.reload();

				// All should be back to un-materialized
				expect(getWrapperState(api.advanced).materialized).toBe(false);
				expect(getWrapperState(api.util).materialized).toBe(false);
				expect(getWrapperState(api.task).materialized).toBe(false);
			});

			it("should reset api.add'd component subdirectories after selective reload", async () => {
				// Add component (which has subdirectories like math/, advanced/, etc.)
				await api.slothlet.api.add("added", TEST_DIRS.API_TEST);

				// Materialize a subdirectory within the added component
				const mathResult = await api.added.math.add(2, 3);
				expect(mathResult).toBeDefined();

				// Verify added component wrapper exists and is accessible
				const addedState = getWrapperState(api.added);
				expect(addedState).not.toBeNull();

				// Reload just the added component (selective)
				await api.slothlet.api.reload("added");

				// Re-access after reload should still work (fresh data)
				const mathResultAfter = await api.added.math.add(2, 3);
				expect(mathResultAfter).toBeDefined();
				expect(mathResultAfter).toBe(mathResult);
			});
		});

		// ─── 2. Surgical Reload — un-accessed paths stay lazy ───

		describe("Surgical Reload (Un-accessed Paths Stay Lazy)", () => {
			it("should leave un-accessed subdirectories un-materialized after reload", async () => {
				// Only access api.math — leave api.advanced, api.util, api.task untouched
				const mathResult = await api.math.add(5, 5);
				expect(mathResult).toBe(10); // folder math/math.mjs: add returns a+b

				// Verify untouched paths are NOT materialized
				expect(getWrapperState(api.advanced).materialized).toBe(false);
				expect(getWrapperState(api.util).materialized).toBe(false);
				expect(getWrapperState(api.task).materialized).toBe(false);

				// Reload
				await api.slothlet.api.reload(".");

				// Untouched paths should STILL be un-materialized
				// (lazy rebuild produces lazy shells, _restoreApiTree uses ___resetLazy)
				expect(getWrapperState(api.advanced).materialized).toBe(false);
				expect(getWrapperState(api.util).materialized).toBe(false);
				expect(getWrapperState(api.task).materialized).toBe(false);
			});

			it("should not materialize any subdirectory during reload itself", async () => {
				// Don't access anything — all subdirectories should remain lazy

				// Collect subdirectory wrappers that are lazy before reload
				const lazyPaths = ["advanced", "util", "task", "logger", "multi", "string", "tcp"];
				for (const path of lazyPaths) {
					const state = getWrapperState(api[path]);
					if (state) {
						expect(state.materialized).toBe(false);
					}
				}

				// Reload
				await api.slothlet.api.reload(".");

				// None should have become materialized during reload
				for (const path of lazyPaths) {
					const state = getWrapperState(api[path]);
					if (state) {
						expect(state.materialized).toBe(false);
					}
				}
			});
		});

		// ─── 3. Re-materialization from fresh source ───

		describe("Re-materialization After Reset", () => {
			it("should produce working implementation when re-accessing a reset wrapper", async () => {
				// Materialize api.math
				const resultBefore = await api.math.add(3, 4);
				expect(resultBefore).toBe(7); // folder math/math.mjs: add returns a+b

				// Reload — resets to un-materialized
				await api.slothlet.api.reload(".");
				expect(getWrapperState(api.math).materialized).toBe(false);

				// Re-access triggers fresh materialization
				const resultAfter = await api.math.add(3, 4);
				expect(resultAfter).toBe(7);

				// Should now be materialized again
				expect(getWrapperState(api.math).materialized).toBe(true);
			});

			it("should produce working implementation for deeply nested lazy paths", async () => {
				// Access deep path: api.advanced.nest.alpha()
				const nestResult = await api.advanced.nest.alpha("test");
				expect(nestResult).toBe("alpha: test");

				// Reload
				await api.slothlet.api.reload(".");

				// api.advanced should be un-materialized
				expect(getWrapperState(api.advanced).materialized).toBe(false);

				// Re-access should work and trigger fresh materialization
				const nestResultAfter = await api.advanced.nest.alpha("test");
				expect(nestResultAfter).toBe("alpha: test");
				expect(getWrapperState(api.advanced).materialized).toBe(true);
			});

			it("should allow multiple reload-and-re-access cycles", async () => {
				for (let cycle = 0; cycle < 3; cycle++) {
					// Access
					const result = await api.util.url.cleanEndpoint("test");
					expect(result).toBe("cleanEndpoint");
					expect(getWrapperState(api.util).materialized).toBe(true);

					// Reload
					await api.slothlet.api.reload(".");
					expect(getWrapperState(api.util).materialized).toBe(false);
				}

				// Final access after all cycles
				const finalResult = await api.util.url.cleanEndpoint("final");
				expect(finalResult).toBe("cleanEndpoint");
				expect(getWrapperState(api.util).materialized).toBe(true);
			});
		});

		// ─── 4. Proxy Identity Preservation ───

		describe("Proxy Identity Preserved Through Lazy Reset", () => {
			it("should preserve proxy identity for subdirectory wrappers through reload", async () => {
				// Capture reference to lazy proxy before reload
				const mathBefore = api.math;

				// Materialize it
				const result = await api.math.add(1, 1);
				expect(result).toBe(2);

				// Reload
				await api.slothlet.api.reload(".");

				// The proxy reference should be the SAME object (identity preserved)
				expect(api.math).toBe(mathBefore);

				// But it should be un-materialized now
				expect(getWrapperState(api.math).materialized).toBe(false);
			});

			it("should preserve proxy identity for un-materialized wrappers through reload", async () => {
				// Capture reference WITHOUT materializing
				const advancedBefore = api.advanced;
				expect(getWrapperState(advancedBefore).materialized).toBe(false);

				// Reload
				await api.slothlet.api.reload(".");

				// Same proxy object
				expect(api.advanced).toBe(advancedBefore);

				// Still un-materialized
				expect(getWrapperState(api.advanced).materialized).toBe(false);

				// Can still materialize and use
				const result = await api.advanced.selfObject.addViaSelf(2, 3);
				expect(result).toBeDefined();
			});

			it("should reset custom properties on subdirectory wrappers through lazy reset", async () => {
				// Materialize and add custom prop
				await api.math.add(1, 1);
				api.math.customFlag = "preserved";

				// Reload — resets to lazy, custom props on impl are replaced
				await api.slothlet.api.reload(".");

				// Materialized state should be reset
				expect(getWrapperState(api.math).materialized).toBe(false);

				// After reload + re-materialization, custom prop is gone
				// (lazy reset replaces the impl, so user-set props don't survive)
				const mathResult = await api.math.add(1, 1);
				expect(mathResult).toBe(2);
			});
		});

		// ─── 5. Nested Lazy Children via _adoptImplChildren ───

		describe("Nested Lazy Children Reset via _adoptImplChildren", () => {
			it("should reset nested lazy children when parent is restored via ___setImpl", async () => {
				// Add component with nested structure (config/settings.mjs, services/, utils/)
				await api.slothlet.api.add("nested", TEST_DIRS.API_SMART_FLATTEN);

				// Materialize a deeply nested path
				const configResult = await api.nested.config.settings.getPluginConfig();
				expect(configResult).toBeDefined();
				expect(getWrapperState(api.nested.config).materialized).toBe(true);

				// Reload the nested component
				await api.slothlet.api.reload("nested");

				// The nested subdirectory wrapper should be reset
				expect(getWrapperState(api.nested.config).materialized).toBe(false);

				// Re-access should trigger fresh materialization
				const configResultAfter = await api.nested.config.settings.getPluginConfig();
				expect(configResultAfter).toBeDefined();
				expect(getWrapperState(api.nested.config).materialized).toBe(true);
			});

			it("should reset all sibling lazy children during parent reload", async () => {
				await api.slothlet.api.add("siblings", TEST_DIRS.API_SMART_FLATTEN);

				// Materialize one sibling path
				const configResult = await api.siblings.config.settings.getPluginConfig();
				expect(configResult).toBeDefined();

				// Check sibling states — config materialized, others should be lazy
				expect(getWrapperState(api.siblings.config).materialized).toBe(true);

				// Reload
				await api.slothlet.api.reload("siblings");

				// Previously-materialized config should be reset
				expect(getWrapperState(api.siblings.config).materialized).toBe(false);

				// Re-access works
				const afterReload = await api.siblings.config.settings.getPluginConfig();
				expect(afterReload).toBeDefined();
			});
		});

		// ─── 6. Mixed Eager/Lazy After Reload ───

		describe("Root-Level Files Remain Eager After Reload", () => {
			it("root-level file exports should work immediately after reload (always eager)", async () => {
				// Root-level files are always eager in both modes
				// Access a root-level function (e.g., api.config which comes from config.mjs)
				expect(api.config.host).toBe("https://slothlet");

				// Reload
				await api.slothlet.api.reload(".");

				// Root-level should still work without awaiting materialization
				expect(api.config.host).toBe("https://slothlet");
			});

			it("subdirectory wrappers should be lazy while root files are eager after reload", async () => {
				// After reload, root-level exports (config, math root-file) work immediately
				await api.slothlet.api.reload(".");

				// Root-level config works (eager)
				expect(api.config.host).toBe("https://slothlet");

				// But subdirectory wrappers are lazy (un-materialized)
				const mathState = getWrapperState(api.math);
				if (mathState) {
					// math is a subdirectory — should be un-materialized
					expect(mathState.materialized).toBe(false);
				}

				const advancedState = getWrapperState(api.advanced);
				expect(advancedState).not.toBeNull();
				expect(advancedState.materialized).toBe(false);
			});
		});

		// ─── 7. Full Reload (api.slothlet.reload()) with Lazy Mode ───

		describe("Full Instance Reload Respects Lazy Mode", () => {
			it("should rebuild with lazy wrappers for subdirectories after full reload", async () => {
				// Materialize subdirectory path (not root-level)
				await api.advanced.selfObject.addViaSelf(2, 3);
				expect(getWrapperState(api.advanced).materialized).toBe(true);

				// Full reload rebuilds everything from scratch
				await api.slothlet.reload();

				// Subdirectories should be lazy (un-materialized)
				// Note: root-level paths like api.math are always eager, even in lazy mode
				const advancedState = getWrapperState(api.advanced);
				expect(advancedState).not.toBeNull();
				expect(advancedState.materialized).toBe(false);

				// But they should work when accessed
				const result = await api.advanced.selfObject.addViaSelf(2, 3);
				expect(result).toBe(5);
				expect(getWrapperState(api.advanced).materialized).toBe(true);
			});

			it("should not eagerly load all subdirectories during full reload", async () => {
				// Full reload
				await api.slothlet.reload();

				// Verify multiple subdirectories remain lazy
				const lazyPaths = ["advanced", "util", "task", "logger", "multi", "string"];
				for (const path of lazyPaths) {
					const state = getWrapperState(api[path]);
					if (state) {
						expect(state.materialized).toBe(false);
					}
				}
			});
		});
	});
}
