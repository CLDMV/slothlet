/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/core-reference-persistence.test.vitest.mjs
 *	@Date: 2026-02-06T23:45:39-08:00 (1770450339)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:01:59 -08:00 (1770775319)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for reference persistence and live binding throughout API lifecycle
 * Ensures captured references stay valid through ___setImpl, cache updates, and reloads
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const configs = getMatrixConfigs();

for (const { config, name } of configs) {
	describe(`Reference Persistence - ${name}`, () => {
		let slothlet;
		let api;

		beforeEach(async () => {
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;

			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: {
					mutations: {
						add: true
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

		describe("Initial API Reference", () => {
			it("should maintain live reference to root API", async () => {
				const capturedApi = api;

				// Add component dynamically
				await api.slothlet.api.add("dynamic", TEST_DIRS.API_TEST);

				// Captured reference should see new property
				expect(capturedApi.dynamic).toBeDefined();
				const dynamicResult = config.mode === "lazy" ? await capturedApi.dynamic.math.add(1, 1) : capturedApi.dynamic.math.add(1, 1);
				expect(dynamicResult).toBe(1002);
			});

			it("should maintain live reference through wrapper chain", async () => {
				const capturedMath = api.math;
				const originalResult = config.mode === "lazy" ? await capturedMath.add(5, 5) : capturedMath.add(5, 5);

				expect(originalResult).toBe(1010);
				expect(capturedMath.add).toBe(api.math.add); // Same reference
			});
		});

		describe("Cache-Wrapper Reference Relationship", () => {
			it("should maintain wrapper._impl reference to cached API", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				const wrapper = resolveWrapper(api.testComp);
				const slothletInstance = wrapper.slothlet;
				const cacheManager = slothletInstance.handlers.apiCacheManager;

				// Find cache entry
				const allModuleIDs = cacheManager.getAllModuleIDs();
				let moduleID = null;
				for (const mid of allModuleIDs) {
					const entry = cacheManager.get(mid);
					if (entry?.endpoint === "testComp") {
						moduleID = mid;
						break;
					}
				}

				const cacheEntry = cacheManager.get(moduleID);

				// Verify wrapper.__impl is a reference to cached API
				expect(wrapper.__impl).toBe(cacheEntry.api);
			});

			it("should reflect cache modifications in user API", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				const wrapper = resolveWrapper(api.testComp);
				const slothletInstance = wrapper.slothlet;
				const cacheManager = slothletInstance.handlers.apiCacheManager;

				// Find cache entry
				const allModuleIDs = cacheManager.getAllModuleIDs();
				let moduleID = null;
				for (const mid of allModuleIDs) {
					const entry = cacheManager.get(mid);
					if (entry?.endpoint === "testComp") {
						moduleID = mid;
						break;
					}
				}

				const cacheEntry = cacheManager.get(moduleID);

				// Modify cached API directly
				const originalFn = cacheEntry.api.math.add;
				cacheEntry.api.math.add = (a, b) => a + b + 9000;

				// User API should reflect change
				const cacheModResult = config.mode === "lazy" ? await api.testComp.math.add(5, 5) : api.testComp.math.add(5, 5);
				expect(cacheModResult).toBe(9010);

				// Restore for cleanup
				cacheEntry.api.math.add = originalFn;
			});
		});

		describe("___setImpl Reference Persistence", () => {
			it("should maintain top-level reference after ___setImpl", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				// Capture reference before ___setImpl
				const capturedTestComp = api.testComp;
				const topLevelInitial = config.mode === "lazy" ? await capturedTestComp.math.add(1, 1) : capturedTestComp.math.add(1, 1);
				expect(topLevelInitial).toBe(1002);

				// Call ___setImpl with new implementation
				const wrapper = resolveWrapper(api.testComp);
				const newImpl = {
					math: {
						add: (a, b) => a + b + 5000
					}
				};
				wrapper.___setImpl(newImpl, "test-module");

				// Captured reference should use new implementation
				const topLevelUpdated = config.mode === "lazy" ? await capturedTestComp.math.add(1, 1) : capturedTestComp.math.add(1, 1);
				expect(topLevelUpdated).toBe(5002);
			});

			it("should maintain nested reference after ___setImpl", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				// Pre-materialize by calling through api first
				const preMaterial = config.mode === "lazy" ? await api.testComp.math.add(1, 1) : api.testComp.math.add(1, 1);
				expect(preMaterial).toBe(1002);

				// NOW capture nested reference after materialization
				const capturedMath = api.testComp.math;
				const nestedInitial = config.mode === "lazy" ? await capturedMath.add(1, 1) : capturedMath.add(1, 1);
				expect(nestedInitial).toBe(1002);

				// Call ___setImpl with new implementation
				const wrapper = resolveWrapper(api.testComp);
				const newImpl = {
					math: {
						add: (a, b) => a + b + 5000
					}
				};
				wrapper.___setImpl(newImpl, "test-module");

				// Captured nested reference should use new implementation (live binding)
				const nestedUpdated = config.mode === "lazy" ? await capturedMath.add(1, 1) : capturedMath.add(1, 1);
				expect(nestedUpdated).toBe(5002);
			});

			it("should maintain function reference after ___setImpl", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				// Pre-materialize by calling through api first
				const preMaterial = config.mode === "lazy" ? await api.testComp.math.add(1, 1) : api.testComp.math.add(1, 1);
				expect(preMaterial).toBe(1002);

				// NOW capture function reference after materialization
				const capturedAdd = api.testComp.math.add;
				const funcInitial = config.mode === "lazy" ? await capturedAdd(1, 1) : capturedAdd(1, 1);
				expect(funcInitial).toBe(1002);

				// Call ___setImpl with new implementation
				const wrapper = resolveWrapper(api.testComp);
				const newImpl = {
					math: {
						add: (a, b) => a + b + 5000
					}
				};
				wrapper.___setImpl(newImpl, "test-module");

				// Captured function reference should use new implementation (live binding)
				const funcUpdated = config.mode === "lazy" ? await capturedAdd(1, 1) : capturedAdd(1, 1);
				expect(funcUpdated).toBe(5002);
			});

			it("should maintain references at all nesting levels after ___setImpl", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				// Capture at various nesting levels (use actual 4-level deep path)
				const level1 = api.testComp;
				const level2 = api.testComp.advanced;
				const level3 = api.testComp.advanced.nest2;
				const level4 = api.testComp.advanced.nest2.alpha;

				// Test before ___setImpl
				const resultBefore = config.mode === "lazy" ? await level4.hello() : level4.hello();
				expect(resultBefore).toBe("alpha hello");

				// Call ___setImpl with new implementation
				const wrapper = resolveWrapper(api.testComp);
				const newImpl = {
					advanced: {
						nest2: {
							alpha: {
								hello: () => "NEW_ALPHA_HELLO"
							}
						}
					}
				};
				wrapper.___setImpl(newImpl, "test-module");

				// All levels should use new implementation
				const result1 = config.mode === "lazy" ? await level1.advanced.nest2.alpha.hello() : level1.advanced.nest2.alpha.hello();
				const result2 = config.mode === "lazy" ? await level2.nest2.alpha.hello() : level2.nest2.alpha.hello();
				const result3 = config.mode === "lazy" ? await level3.alpha.hello() : level3.alpha.hello();
				const result4 = config.mode === "lazy" ? await level4.hello() : level4.hello();

				expect(result1).toBe("NEW_ALPHA_HELLO");
				expect(result2).toBe("NEW_ALPHA_HELLO");
				expect(result3).toBe("NEW_ALPHA_HELLO");
				expect(result4).toBe("NEW_ALPHA_HELLO");
			});
		});

		describe("Multiple ___setImpl Calls", () => {
			it("should maintain references through multiple ___setImpl updates", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				// Pre-materialize by calling through api first
				const preMaterial = config.mode === "lazy" ? await api.testComp.math.add(1, 1) : api.testComp.math.add(1, 1);
				expect(preMaterial).toBe(1002);

				// NOW capture reference after materialization
				const capturedMath = api.testComp.math;
				const wrapper = resolveWrapper(api.testComp);

				// Initial state
				const multiInitial = config.mode === "lazy" ? await capturedMath.add(1, 1) : capturedMath.add(1, 1);
				expect(multiInitial).toBe(1002);

				// First update
				wrapper.___setImpl(
					{
						math: {
							add: (a, b) => a + b + 2000
						}
					},
					"test-1"
				);
				const multiUpdate1 = config.mode === "lazy" ? await capturedMath.add(1, 1) : capturedMath.add(1, 1);
				expect(multiUpdate1).toBe(2002);

				// Second update
				wrapper.___setImpl(
					{
						math: {
							add: (a, b) => a + b + 3000
						}
					},
					"test-2"
				);
				const multiUpdate2 = config.mode === "lazy" ? await capturedMath.add(1, 1) : capturedMath.add(1, 1);
				expect(multiUpdate2).toBe(3002);

				// Third update
				wrapper.___setImpl(
					{
						math: {
							add: (a, b) => a + b + 4000
						}
					},
					"test-3"
				);
				const multiUpdate3 = config.mode === "lazy" ? await capturedMath.add(1, 1) : capturedMath.add(1, 1);
				expect(multiUpdate3).toBe(4002);
			});

			it("should handle ___setImpl with changing structure", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				const captured = api.testComp;
				const wrapper = resolveWrapper(api.testComp);

				// Start with math only
				wrapper.___setImpl(
					{
						math: {
							add: (a, b) => a + b + 1000
						}
					},
					"test-1"
				);
				const structResult1 = config.mode === "lazy" ? await captured.math.add(1, 1) : captured.math.add(1, 1);
				expect(structResult1).toBe(1002);

				// Add config property
				wrapper.___setImpl(
					{
						math: {
							add: (a, b) => a + b + 2000
						},
						config: {
							version: "2.0.0"
						}
					},
					"test-2"
				);
				const structResult2 = config.mode === "lazy" ? await captured.math.add(1, 1) : captured.math.add(1, 1);
				expect(structResult2).toBe(2002);
				expect(captured.config.version).toBe("2.0.0");

				// Remove math, keep config
				wrapper.___setImpl(
					{
						config: {
							version: "3.0.0"
						}
					},
					"test-3"
				);
				expect(captured.config.version).toBe("3.0.0");
			});
		});

		describe("Reference Persistence After Property Changes", () => {
			it("should maintain references when adding new properties", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				// Pre-materialize by calling through api first
				const preMaterial = config.mode === "lazy" ? await api.testComp.math.add(1, 1) : api.testComp.math.add(1, 1);
				expect(preMaterial).toBe(1002);

				// NOW capture reference after materialization
				const capturedMath = api.testComp.math;
				const wrapper = resolveWrapper(api.testComp);

				// Add new property alongside existing
				wrapper.___setImpl(
					{
						math: {
							add: (a, b) => a + b + 7000,
							subtract: (a, b) => a - b
						}
					},
					"test-expand",
					true
				);

				// Reference should work with new implementation
				const addResult = config.mode === "lazy" ? await capturedMath.add(1, 1) : capturedMath.add(1, 1);
				expect(addResult).toBe(7002);

				// New property should be accessible
				const subtractResult = config.mode === "lazy" ? await capturedMath.subtract(10, 3) : capturedMath.subtract(10, 3);
				expect(subtractResult).toBe(7);
			});

			it("should maintain references when properties are removed", async () => {
				await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

				// Pre-materialize by calling through api first
				const preMaterial = config.mode === "lazy" ? await api.testComp.math.add(1, 1) : api.testComp.math.add(1, 1);
				expect(preMaterial).toBe(1002);

				// NOW capture reference after materialization
				const capturedTestComp = api.testComp;
				const wrapper = resolveWrapper(api.testComp);

				// Remove most properties, keep only math
				wrapper.___setImpl(
					{
						math: {
							add: (a, b) => a + b + 8000
						}
					},
					"test-reduce",
					true
				);

				// Reference should still work for remaining property
				const removeResult = config.mode === "lazy" ? await capturedTestComp.math.add(1, 1) : capturedTestComp.math.add(1, 1);
				expect(removeResult).toBe(8002);
			});
		});

		describe("Cross-Reference Behavior", () => {
			it("should maintain references across different capture points", async () => {
				await api.slothlet.api.add("comp1", TEST_DIRS.API_TEST);
				await api.slothlet.api.add("comp2", TEST_DIRS.API_TEST);

				// Pre-materialize both by calling through api first
				const preMat1 = config.mode === "lazy" ? await api.comp1.math.add(1, 1) : api.comp1.math.add(1, 1);
				const preMat2 = config.mode === "lazy" ? await api.comp2.math.add(1, 1) : api.comp2.math.add(1, 1);
				expect(preMat1).toBe(1002);
				expect(preMat2).toBe(1002);

				// NOW capture references after materialization
				const ref1Math = api.comp1.math;
				const ref2Math = api.comp2.math;

				// Both should work independently
				const crossInitial1 = config.mode === "lazy" ? await ref1Math.add(1, 1) : ref1Math.add(1, 1);
				const crossInitial2 = config.mode === "lazy" ? await ref2Math.add(1, 1) : ref2Math.add(1, 1);
				expect(crossInitial1).toBe(1002);
				expect(crossInitial2).toBe(1002);

				// Update comp1 only
				const wrapper1 = resolveWrapper(api.comp1);
				wrapper1.___setImpl(
					{
						math: {
							add: (a, b) => a + b + 5000
						}
					},
					"test-comp1",
					true
				);

				// Only ref1 should change
				const crossUpdated1 = config.mode === "lazy" ? await ref1Math.add(1, 1) : ref1Math.add(1, 1);
				const crossUpdated2 = config.mode === "lazy" ? await ref2Math.add(1, 1) : ref2Math.add(1, 1);
				expect(crossUpdated1).toBe(5002);
				expect(crossUpdated2).toBe(1002); // comp2 unchanged
			});
		});
	});
}
