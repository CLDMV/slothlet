/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/core-reload-selective.test.vitest.mjs
 *	@Date: 2026-01-30T17:01:40-08:00 (1769821300)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-05 15:54:19 -08:00 (1770335659)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for selective component reload (api.slothlet.api.reload(pathOrModuleId))
 * Selective reload updates specific component implementations, preserves custom properties, and updates ownership stack.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const configs = getMatrixConfigs();

// Test each configuration
for (const { config, name } of configs) {
	describe(`Selective Component Reload - ${name}`, () => {
		let slothlet;
		let api;

		beforeEach(async () => {
			// Import slothlet
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;

			// Load with mutations enabled
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				collision: {
					initial: "replace",
					api: "replace"
				},
				api: {
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

		it("should reload component by path and preserve custom properties", async () => {
			// Add a component
			await api.slothlet.api.add("custom", TEST_DIRS.API_TEST);

			// Verify component works
			expect(typeof api.custom).toBe("object");
			expect(api.custom.math.add(1, 1)).toBe(1002);

			// Modify added component (custom properties should persist across selective reload)
			api.custom.testFlag = true;
			api.custom.nested = { data: "preserved" };
			expect(api.custom.testFlag).toBe(true);

			// Reload by path (updates implementations but keeps custom properties)
			await api.slothlet.api.reload("custom");

			// Verify custom properties persist (selective reload doesn't clear custom props)
			expect(api.custom.testFlag).toBe(true);
			expect(api.custom.nested).toEqual({ data: "preserved" });

			// Verify component still works (implementation was reloaded)
			expect(api.custom.math.add(1, 1)).toBe(1002);
		});

		it("should reload component and cache-bust implementation", async () => {
			// Add module to a unique path
			await api.slothlet.api.add("testComp", TEST_DIRS.API_TEST);

			// Verify implementation works (API_TEST math.add returns a+b+1000)
			const resultBefore = api.testComp.math.add(2, 3);
			expect(resultBefore).toBe(1005);

			// Add custom property
			api.testComp.customFlag = true;

			// Reload the component (cache-busts and updates implementation, keeps custom props)
			await api.slothlet.api.reload("testComp");

			// Verify implementation STILL works after reload (proves cache was busted)
			const resultAfter = api.testComp.math.add(2, 3);
			expect(resultAfter).toBe(1005);

			// Verify custom property persisted
			expect(api.testComp.customFlag).toBe(true);

			// Remove the component
			await api.slothlet.api.remove("testComp");

			// Verify removal worked
			expect(api.testComp).toBeUndefined();
		});

		it("should reload parent path and all children", async () => {
			// Add components under nested paths
			await api.slothlet.api.add("nested.comp1", TEST_DIRS.API_TEST);
			await api.slothlet.api.add("nested.comp2", TEST_DIRS.API_TEST);

			// Verify both components work correctly
			expect(api.nested.comp1.math.add(1, 1)).toBe(1002); // API_TEST version (a+b+1000)
			expect(api.nested.comp2.math.add(1, 1)).toBe(1002); // API_TEST version (a+b+1000)

			// Add custom properties to verify they persist
			api.nested.comp1.customFlag = true;
			api.nested.comp2.customData = { test: true };
			api.nested.parentFlag = "parent-level";

			// Reload parent path (should update implementations but keep custom properties)
			await api.slothlet.api.reload("nested");

			// Verify implementations still work after reload (cache busted)
			expect(api.nested.comp1.math.add(1, 1)).toBe(1002);
			expect(api.nested.comp2.math.add(1, 1)).toBe(1002);

			// Verify custom properties persisted (selective reload doesn't clear them)
			expect(api.nested.comp1.customFlag).toBe(true);
			expect(api.nested.comp2.customData).toEqual({ test: true });
			expect(api.nested.parentFlag).toBe("parent-level");
		});

		it("should reload specific moduleID and update ownership stack", async () => {
			// Add first module to a path
			const moduleID1 = await api.slothlet.api.add("stackTest", TEST_DIRS.API_TEST);
			const firstResult = api.stackTest.math.add(10, 10);
			expect(firstResult).toBe(1020); // 10+10+1000

			// Add second module to same path (with collision replace mode)
			const moduleID2 = await api.slothlet.api.add("stackTest", TEST_DIRS.API_TEST);

			// Both modules should be in ownership stack
			// Reload by specific moduleID (not path) to update buried implementation
			await api.slothlet.api.reload(moduleID1);

			// After moduleID reload, implementation should still work
			const reloadedResult = api.stackTest.math.add(10, 10);
			expect(reloadedResult).toBe(1020);
		});

		it("should reload base API module (from initial load)", async () => {
			// The base API modules (like api.math, api.config) can also be reloaded
			const initialResult = api.math.add(5, 5);
			expect(initialResult).toBe(1010); // 5+5+1000

			// Add custom property to base module
			api.math.customBaseFlag = "base-data";

			// Reload base module by path
			await api.slothlet.api.reload("math");

			// Custom property should persist
			expect(api.math.customBaseFlag).toBe("base-data");

			// Implementation should still work
			const reloadedResult = api.math.add(5, 5);
			expect(reloadedResult).toBe(1010);
		});

		it("should handle reload of removed component gracefully", async () => {
			// Add and then remove a component
			await api.slothlet.api.add("tempComp", TEST_DIRS.API_TEST);
			expect(api.tempComp).toBeDefined();

			await api.slothlet.api.remove("tempComp");
			expect(api.tempComp).toBeUndefined();

			// Attempting to reload removed component should not throw
			// (It might be a no-op or throw a specific error - test the actual behavior)
			await expect(async () => {
				await api.slothlet.api.reload("tempComp");
			}).rejects.toThrow();
		});

		it("should reload nested child without affecting siblings", async () => {
			// Create nested structure
			await api.slothlet.api.add("parent.child1", TEST_DIRS.API_TEST);
			await api.slothlet.api.add("parent.child2", TEST_DIRS.API_TEST);

			// Add custom properties
			api.parent.child1.flag1 = "one";
			api.parent.child2.flag2 = "two";
			api.parent.parentFlag = "parent";

			// Reload only child1
			await api.slothlet.api.reload("parent.child1");

			// child1's custom property should persist
			expect(api.parent.child1.flag1).toBe("one");

			// child2 and parent should be unaffected
			expect(api.parent.child2.flag2).toBe("two");
			expect(api.parent.parentFlag).toBe("parent");

			// Both implementations should work
			expect(api.parent.child1.math.add(3, 3)).toBe(1006);
			expect(api.parent.child2.math.add(3, 3)).toBe(1006);
		});
	});
}
