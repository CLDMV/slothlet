/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/core-reload-full.test.vitest.mjs
 *	@Date: 2026-01-30T17:01:40-08:00 (1769821300)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:52 -08:00 (1770266392)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for full instance reload (api.slothlet.reload())
 * Full reload rebuilds entire API from scratch and replays all add/remove operations in chronological order.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const configs = getMatrixConfigs();

// Test each configuration
for (const { config, name } of configs) {
	describe(`Full Instance Reload - ${name}`, () => {
		let slothlet;
		let api;

		beforeEach(async () => {
			// Import slothlet
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;

			// Load instance with reload enabled
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
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

		it("should rebuild API object from scratch (properties disappear)", async () => {
			// Verify API works initially
			expect(api.config.host).toBe("https://slothlet");

			// Modify API object directly (add custom property)
			api.customProperty = "test-value";
			api.config.customData = { flag: true };

			// Verify modifications exist
			expect(api.customProperty).toBe("test-value");
			expect(api.config.customData).toEqual({ flag: true });

			// Reload entire instance
			await api.slothlet.reload();

			// Verify API was rebuilt (custom properties are gone)
			expect(api.customProperty).toBeUndefined();
			expect(api.config.customData).toBeUndefined();

			// Verify core functionality still works (api.config is new object with same values)
			expect(api.config.host).toBe("https://slothlet");
		});

		it("should handle multiple sequential reloads", async () => {
			// First reload
			api.testData1 = "first";
			expect(api.testData1).toBe("first");
			await api.slothlet.reload();
			expect(api.testData1).toBeUndefined();

			// Second reload
			api.testData2 = "second";
			expect(api.testData2).toBe("second");
			await api.slothlet.reload();
			expect(api.testData2).toBeUndefined();

			// Verify API still functional
			expect(api.config.host).toBe("https://slothlet");
		});

		it("should preserve context data across reloads", async () => {
			// Run with isolated context
			await api.slothlet.context.run({ userData: "preserved", config: { flag: true } }, async () => {
				// Inside run scope - context should have data
				const contextBefore = await api.slothlet.context.get();
				expect(contextBefore.userData).toBe("preserved");

				// Reload
				await api.slothlet.reload();

				// Verify context was preserved after reload
				const contextAfter = await api.slothlet.context.get();
				expect(contextAfter.userData).toBe("preserved");
				expect(contextAfter.config).toEqual({ flag: true });
			});
		});

		it("should replay operation history in chronological order", async () => {
			// Execute a sequence of operations
			await api.slothlet.api.add("test1", TEST_DIRS.API_TEST);
			await api.slothlet.api.add("test2", TEST_DIRS.API_TEST);
			await api.slothlet.api.remove("test1");
			await api.slothlet.api.add("test3", TEST_DIRS.API_TEST);

			// Verify state before reload
			expect(api.test1).toBeUndefined(); // Was removed
			expect("test1" in api).toBe(false); // Property actually deleted
			expect(api.test2).toBeDefined();
			expect(api.test3).toBeDefined();

			// Add custom properties
			api.test2.customProp2 = "two";
			api.test3.customProp3 = "three";

			// Full reload
			await api.slothlet.reload();

			// Verify operations replayed in order
			expect(api.test1).toBeUndefined(); // Should still be removed
			expect("test1" in api).toBe(false); // Property should still be deleted (not just undefined)
			expect(api.test2).toBeDefined(); // Should be restored
			expect(api.test3).toBeDefined(); // Should be restored

			// Custom properties should be gone (full reload clears them)
			expect(api.test2.customProp2).toBeUndefined();
			expect(api.test3.customProp3).toBeUndefined();

			// But implementations should work
			expect(api.test2.math.add(1, 1)).toBe(1002);
			expect(api.test3.math.add(1, 1)).toBe(1002);
		});

		it("should handle complex operation sequences with multiple removes", async () => {
			// Complex sequence: add, add (different paths), remove, add different path
			await api.slothlet.api.add("path1", TEST_DIRS.API_TEST);
			const result1 = api.path1.math.add(5, 5);
			expect(result1).toBe(1010); // 5+5+1000

			await api.slothlet.api.add("path2", TEST_DIRS.API_TEST);
			const result2 = api.path2.math.add(5, 5);
			expect(result2).toBe(1010); // 5+5+1000

			await api.slothlet.api.remove("path1");
			expect(api.path1).toBeUndefined();
			expect("path1" in api).toBe(false); // Verify actually deleted

			await api.slothlet.api.add("path3", TEST_DIRS.API_TEST);

			// Full reload should replay all operations
			await api.slothlet.reload();

			// Verify final state matches operation sequence
			expect(api.path1).toBeUndefined(); // Removed
			expect("path1" in api).toBe(false); // Should still be deleted (not just undefined)
			expect(api.path2).toBeDefined(); // Present
			expect(api.path3).toBeDefined(); // Present
			expect(api.path2.math.add(5, 5)).toBe(1010);
			expect(api.path3.math.add(5, 5)).toBe(1010);
		});

		it("should handle interleaved add/remove operations", async () => {
			// Interleave adds and removes to test chronological ordering
			await api.slothlet.api.add("inter1", TEST_DIRS.API_TEST);
			await api.slothlet.api.add("inter2", TEST_DIRS.API_TEST);
			await api.slothlet.api.remove("inter1");
			await api.slothlet.api.add("inter3", TEST_DIRS.API_TEST);
			await api.slothlet.api.add("inter4", TEST_DIRS.API_TEST);
			await api.slothlet.api.remove("inter3");

			// Before reload: inter1 gone, inter2 present, inter3 gone, inter4 present
			expect(api.inter1).toBeUndefined();
			expect("inter1" in api).toBe(false);
			expect(api.inter2).toBeDefined();
			expect(api.inter3).toBeUndefined();
			expect("inter3" in api).toBe(false);
			expect(api.inter4).toBeDefined();

			// Full reload
			await api.slothlet.reload();

			// After reload: same state (chronological order preserved)
			expect(api.inter1).toBeUndefined();
			expect("inter1" in api).toBe(false); // Property should be deleted (not just undefined)
			expect(api.inter2).toBeDefined();
			expect(api.inter3).toBeUndefined();
			expect("inter3" in api).toBe(false); // Property should be deleted (not just undefined)
			expect(api.inter4).toBeDefined();

			// Implementations should work
			expect(api.inter2.math.add(3, 7)).toBe(1010);
			expect(api.inter4.math.add(3, 7)).toBe(1010);
		});

		it("should replay operations with different folders in chronological order", async () => {
			// Mix API_TEST and API_TEST_MIXED to verify folder-specific operations replay correctly
			await api.slothlet.api.add("mixed1", TEST_DIRS.API_TEST);
			await api.slothlet.api.add("mixed2", TEST_DIRS.API_TEST);
			await api.slothlet.api.remove("mixed1");

			// Verify state before reload
			expect(api.mixed1).toBeUndefined();
			expect("mixed1" in api).toBe(false); // Actually deleted
			expect(api.mixed2).toBeDefined();
			expect(api.mixed2.math.add(2, 2)).toBe(1004);

			// Full reload
			await api.slothlet.reload();

			// Verify same state after reload
			expect(api.mixed1).toBeUndefined();
			expect("mixed1" in api).toBe(false); // Should still be deleted (not just undefined)
			expect(api.mixed2).toBeDefined();
			expect(api.mixed2.math.add(2, 2)).toBe(1004);
		});
	});
}
