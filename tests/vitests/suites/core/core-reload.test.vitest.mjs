/**
 * @fileoverview Vitest tests for api.slothlet.reload() functionality.
 * @module tests/vitests/suites/core/core-reload.test.vitest
 *
 * @description
 * Tests that api.slothlet.reload() properly reloads all modules,
 * preserves hooks, and updates live bindings.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Test each configuration in the matrix
describe.each(getMatrixConfigs())(
	"Core Reload > Config: '$name'",
	({ config }) => {
		let slothlet;
		let api;

		beforeEach(async () => {
			// Dynamic import of published entrypoint to mirror consumer usage
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;

			// Create API instance with the test config + reload enabled
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				collision: { initial: "replace", api: "replace" },
				hook: { enabled: true },
				api: {
					mutations: {
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
			slothlet = null;
		});

		test("should reload API and maintain basic functionality", async () => {
			// Call function before reload
			const resultBefore = await api.math.add(5, 3);
			expect(resultBefore).toBe(8);

			// Reload the API
			const reloadedApi = await api.slothlet.reload();

			// Verify reload returns API
			expect(reloadedApi).toBeDefined();
			expect(typeof reloadedApi.math.add).toBe("function");

			// Call function after reload - should still work
			const resultAfter = await api.math.add(10, 7);
			expect(resultAfter).toBe(17);
		});

		test("should preserve hooks across reload", async () => {
			let beforeCount = 0;
			let afterCount = 0;

			// Register hooks
			api.slothlet.hook.on(
				"before:math.add",
				() => {
					beforeCount++;
				},
				{ id: "before-counter" }
			);

			api.slothlet.hook.on(
				"after:math.add",
				() => {
					afterCount++;
				},
				{ id: "after-counter" }
			);

			// Call function before reload
			await api.math.add(1, 2);
			expect(beforeCount).toBe(1);
			expect(afterCount).toBe(1);

			// Reload
			await api.slothlet.reload();

			// Reset counts
			beforeCount = 0;
			afterCount = 0;

			// Call function after reload - hooks should still fire
			await api.math.add(3, 4);
			expect(beforeCount).toBe(1);
			expect(afterCount).toBe(1);
		});

		test("should preserve always hooks across reload", async () => {
			let alwaysCount = 0;

			api.slothlet.hook.on(
				"always:math.add",
				() => {
					alwaysCount++;
				},
				{ id: "always-counter" }
			);

			// Call before reload
			await api.math.add(1, 1);
			expect(alwaysCount).toBe(1);

			// Reload
			await api.slothlet.reload();

			// Reset count
			alwaysCount = 0;

			// Call after reload - always hook should still fire
			await api.math.add(2, 2);
			expect(alwaysCount).toBe(1);
		});

		test("should update API structure after reload", async () => {
			// Get initial API structure
			const keysBefore = Object.keys(api.math);

			// Reload
			await api.slothlet.reload();

			// Get API structure after reload
			const keysAfter = Object.keys(api.math);

			// Should have same structure
			expect(keysAfter.sort()).toEqual(keysBefore.sort());
		});

		test("should preserve context data across reload", async () => {
			// Set context data
			api.slothlet.context.testValue = "preserved";

			// Reload
			await api.slothlet.reload();

			// Context should still be accessible
			expect(api.slothlet.context.testValue).toBe("preserved");
		});

		test("should throw error if reload config is disabled", async () => {
			// Create new API with reload disabled
			const restrictedApi = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: {
					mutations: {
						reload: false
					}
				}
			});

			try {
				await restrictedApi.slothlet.reload();
				throw new Error("Expected reload to throw");
			} catch (error) {
				expect(error.code).toBe("INVALID_CONFIG_MUTATIONS_DISABLED");
			} finally {
				await restrictedApi.shutdown();
			}
		});

		test("should handle multiple sequential reloads", async () => {
			// Call function
			const result1 = await api.math.add(1, 1);
			expect(result1).toBe(2);

			// First reload
			await api.slothlet.reload();
			const result2 = await api.math.add(2, 2);
			expect(result2).toBe(4);

			// Second reload
			await api.slothlet.reload();
			const result3 = await api.math.add(3, 3);
			expect(result3).toBe(6);

			// Third reload
			await api.slothlet.reload();
			const result4 = await api.math.add(4, 4);
			expect(result4).toBe(8);
		});

		test("should work with alternative access path api.slothlet.api.reload", async () => {
			// Verify alternative path exists
			expect(typeof api.slothlet.api.reload).toBe("function");

			// Call before reload
			const resultBefore = await api.math.add(5, 5);
			expect(resultBefore).toBe(10);

			// Reload using alternative path
			await api.slothlet.api.reload();

			// Verify still works
			const resultAfter = await api.math.add(6, 6);
			expect(resultAfter).toBe(12);
		});
	}
);
