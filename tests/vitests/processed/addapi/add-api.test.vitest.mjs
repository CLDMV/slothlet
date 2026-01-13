/**
 * @fileoverview Test for dynamic API extension using addApi method
 *
 * @description
 * Tests the addApi functionality using the full matrix approach to verify:
 * - Loading modules from a new folder
 * - Merging them at a specified dotted path
 * - Working with both lazy and eager modes
 * - Proper live binding updates
 * - Error handling
 * - allowApiOverwrite configuration
 *
 * Original test: tests/test-add-api.mjs
 * Original test count: 7 test suites (eager, lazy, nested, errors, merge, function extension, allowOverwrite)
 * New test count: 7 tests × 20 matrix configs = 140 tests
 *
 * @module tests/vitests/processed/addapi/add-api.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("addApi Functionality", () => {
	// addApi works on all configurations, no filtering needed
	const matrixConfigs = getMatrixConfigs({});

	describe.each(matrixConfigs)("Config: $name", ({ config }) => {
		let api;

		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});
		});

		afterEach(async () => {
			if (api && typeof api.shutdown === "function") {
				await api.shutdown();
			}
			api = null;
		});
		/**
		 * Test 1: Basic addApi - add API at new dotted path and root level
		 * Covers: test_addApi_eager and test_addApi_lazy from original
		 */
		it("should add API at new paths and root level with working endpoints", async () => {
			// Add API at runtime.newapi path
			await api.addApi("runtime.newapi", TEST_DIRS.API_TEST_MIXED);

			expect(api.runtime).toBeDefined();
			expect(api.runtime.newapi).toBeDefined();
			expect(api.runtime.newapi.mathEsm).toBeDefined();

			// Test that new API endpoints work
			const result = api.runtime.newapi.mathEsm.add(5, 3);
			expect(result).toBe(8);

			// Add API at root level
			await api.addApi("utilities", TEST_DIRS.API_TEST_CJS);
			expect(api.utilities).toBeDefined();
			expect(typeof api.utilities).toBe("object");
		});

		/**
		 * Test 2: Nested path creation
		 * Covers: test_addApi_nested from original
		 */
		it("should create deeply nested path structure", async () => {
			await api.addApi("level1.level2.level3", TEST_DIRS.API_TEST_CJS);

			expect(api.level1).toBeDefined();
			expect(api.level1.level2).toBeDefined();
			expect(api.level1.level2.level3).toBeDefined();
			expect(Object.keys(api.level1.level2.level3).length).toBeGreaterThan(0);
		});

		/**
		 * Test 3: Error handling - 8 error conditions
		 * Covers: test_addApi_errors from original
		 */
		it("should throw appropriate errors for invalid inputs", async () => {
			// Non-existent folder
			await expect(api.addApi("test", "/non/existent/path")).rejects.toThrow("Cannot access folder");

			// Non-string apiPath
			await expect(api.addApi(null, TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("apiPath' must be a string");

			// Empty apiPath
			await expect(api.addApi("", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow(/non-empty/);

			// Consecutive dots
			await expect(api.addApi("path..test", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("empty segments");

			// Leading dot
			await expect(api.addApi(".test", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("empty segments");

			// Trailing dot
			await expect(api.addApi("test.", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("empty segments");

			// Whitespace-only apiPath
			await expect(api.addApi("   ", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow(/non-empty/);

			// Non-string folderPath
			await expect(api.addApi("test", null)).rejects.toThrow("folderPath' must be a string");
		});

		/**
		 * Test 4: Merging into existing objects
		 * Covers: test_addApi_merge from original
		 */
		it("should merge APIs when adding to existing objects", async () => {
			// First addition
			await api.addApi("services.external", TEST_DIRS.API_TEST_MIXED);
			const firstResult = api.services.external.mathEsm.add(5, 5);
			expect(firstResult).toBe(10);

			// Second addition to deeper path
			await api.addApi("services.external.more", TEST_DIRS.API_TEST);

			// Original still works
			const secondResult = api.services.external.mathEsm.add(3, 7);
			expect(secondResult).toBe(10);

			// New addition exists
			expect(api.services.external.more).toBeDefined();
		});

		/**
		 * Test 5: Function extension (function.property pattern)
		 * Covers: test_addApi_function_extension from original
		 */
		it("should handle function extension and reject primitive extension", async () => {
			// Setup
			await api.addApi("test.func", TEST_DIRS.API_TEST_MIXED);
			api.test.myFunction = () => "I'm a function";

			// Add properties to function
			await api.addApi("test.myFunction.nested", TEST_DIRS.API_TEST);

			// Function still works
			expect(api.test.myFunction()).toBe("I'm a function");

			// Nested properties exist
			expect(api.test.myFunction.nested).toBeDefined();

			// Test primitive extension rejection
			api.test.primitive = 42;
			await expect(api.addApi("test.primitive.nested", TEST_DIRS.API_TEST)).rejects.toThrow("cannot add properties");
		});

		/**
		 * Test 6: allowApiOverwrite - merging behavior
		 * Tests that addApi MERGES regardless of allowApiOverwrite setting
		 */
		it("should merge APIs regardless of allowApiOverwrite setting", async () => {
			await api.addApi("test.endpoint", TEST_DIRS.API_TEST_MIXED);
			const initialKeys = Object.keys(api.test.endpoint);

			await api.addApi("test.endpoint", TEST_DIRS.API_TEST_CJS);
			const mergedKeys = Object.keys(api.test.endpoint);

			// Keys should be merged (more or same keys)
			expect(mergedKeys.length).toBeGreaterThanOrEqual(initialKeys.length);
		});

		/**
		 * Test 7: Rule 12 cross-module ownership
		 * Tests allowApiOverwrite: false blocks cross-module, true allows
		 * Requires hotReload for moduleId tracking
		 */
		it("should handle cross-module ownership based on config", async () => {
			// Build addApi options based on config capabilities
			const addApiOptions = { moduleId: "original-module" };
			if (config.hotReload) {
				// Can use moduleId tracking
				await api.addApi("funcTest", TEST_DIRS.API_TEST_MIXED, {}, addApiOptions);
				const originalKeys = Object.keys(api.funcTest);

				// Different module tries to take over
				const shouldBlock = config.hotReload && config.allowApiOverwrite === false;

				if (shouldBlock) {
					// Rule 12 should block cross-module overwrite
					await expect(api.addApi("funcTest", TEST_DIRS.API_TEST_CJS, {}, { moduleId: "hostile-module" })).rejects.toThrow("Rule 12");

					// Original preserved
					expect(Object.keys(api.funcTest)).toEqual(originalKeys);
				} else {
					// Should allow (either no ownership or allowApiOverwrite: true)
					await expect(api.addApi("funcTest", TEST_DIRS.API_TEST_CJS, {}, { moduleId: "new-owner-module" })).resolves.not.toThrow();
				}
			} else {
				// Without hotReload, no ownership tracking - just test basic addApi
				await api.addApi("funcTest", TEST_DIRS.API_TEST_MIXED);
				expect(api.funcTest).toBeDefined();

				// Can add more without moduleId concerns
				await api.addApi("funcTest", TEST_DIRS.API_TEST_CJS);
				expect(Object.keys(api.funcTest).length).toBeGreaterThan(0);
			}
		});
	});
});
