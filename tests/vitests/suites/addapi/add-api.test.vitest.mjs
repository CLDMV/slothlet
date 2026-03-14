/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/addapi/add-api.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:41 -08:00 (1772425301)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test for dynamic API extension using api.slothlet.api.add method
 *
 * @description
 * Tests the api.slothlet.api.add functionality using the full matrix approach to verify:
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
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

describe("api.slothlet.api.add Functionality", () => {
	// api.slothlet.api.add works on all configurations, no filtering needed
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
		 * Test 1: Basic api.slothlet.api.add - add API at new dotted path and root level
		 * Covers: test_addApi_eager and test_addApi_lazy from original
		 */
		it("should add API at new paths and root level with working endpoints", async () => {
			// Add API at runtime.newapi path
			await api.slothlet.api.add("runtime.newapi", TEST_DIRS.API_TEST_MIXED);

			expect(api.runtime).toBeDefined();
			expect(api.runtime.newapi).toBeDefined();
			expect(api.runtime.newapi.mathEsm).toBeDefined();

			// Test that new API endpoints work
			const result = api.runtime.newapi.mathEsm.add(5, 3);
			expect(result).toBe(8);

			// Add API at root level
			await api.slothlet.api.add("utilities", TEST_DIRS.API_TEST_CJS);
			expect(api.utilities).toBeDefined();

			// Trigger materialization for lazy mode before checking typeof
			if (api.utilities.rootMath) {
				await api.utilities.rootMath.add(1, 1);
			}

			// api.utilities might be a function (root contributor) or object
			// Both are valid depending on the module structure
			const utilitiesType = typeof api.utilities;
			expect(["object", "function"]).toContain(utilitiesType);
		});

		/**
		 * Test 2: Nested path creation
		 * Covers: test_addApi_nested from original
		 */
		it("should create deeply nested path structure", async () => {
			await api.slothlet.api.add("level1.level2.level3", TEST_DIRS.API_TEST_CJS);

			expect(api.level1).toBeDefined();
			expect(api.level1.level2).toBeDefined();
			expect(api.level1.level2.level3).toBeDefined();
			expect(Object.keys(api.level1.level2.level3).length).toBeGreaterThan(0);
		});

		/**
		 * Test 3: Error handling - 5 error conditions
		 * Covers: test_addApi_errors from original
		 * Note: null, "", and whitespace-only paths are now valid (root-level addition after trimming)
		 */
		it("should throw appropriate errors for invalid inputs", async () => {
			// Non-existent folder
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add("test", "/non/existent/path")).rejects.toThrow("Configuration error");
			});

			// Consecutive dots
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add("path..test", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("Invalid API path");
			});

			// Leading dot
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add(".test", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("Invalid API path");
			});

			// Trailing dot
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add("test.", TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("Invalid API path");
			});

			// Non-string folderPath
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add("test", null)).rejects.toThrow("Configuration error");
			});
		});

		/**
		 * Test 4: Merging into existing objects
		 * Covers: test_addApi_merge from original
		 */
		it("should merge APIs when adding to existing objects", async () => {
			// First addition
			await api.slothlet.api.add("services.external", TEST_DIRS.API_TEST_MIXED);
			const firstResult = api.services.external.mathEsm.add(5, 5);
			expect(firstResult).toBe(10);

			// Second addition to deeper path
			await api.slothlet.api.add("services.external.more", TEST_DIRS.API_TEST);

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
			await api.slothlet.api.add("test.func", TEST_DIRS.API_TEST_MIXED);
			api.test.myFunction = () => "I'm a function";

			// Add properties to function
			await api.slothlet.api.add("test.myFunction.nested", TEST_DIRS.API_TEST);

			// Function still works
			expect(api.test.myFunction()).toBe("I'm a function");

			// Nested properties exist
			expect(api.test.myFunction.nested).toBeDefined();

			// Test primitive extension rejection
			api.test.primitive = 42;
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add("test.primitive.nested", TEST_DIRS.API_TEST)).rejects.toThrow("Invalid API path");
			});
		});

		// TODO: This option isn't even tested here and is also not an option in V3...
		/**
		 * Test 6: allowAddApiOverwrite - merging behavior
		 * Tests that api.slothlet.api.add MERGES regardless of allowAddApiOverwrite setting
		 */
		it("should merge APIs regardless of allowAddApiOverwrite setting", async () => {
			await api.slothlet.api.add("test.endpoint", TEST_DIRS.API_TEST_MIXED);
			const initialKeys = Object.keys(api.test.endpoint);

			await api.slothlet.api.add("test.endpoint", TEST_DIRS.API_TEST_CJS);
			const mergedKeys = Object.keys(api.test.endpoint);

			// Keys should be merged (more or same keys)
			expect(mergedKeys.length).toBeGreaterThanOrEqual(initialKeys.length);
		});

		// TODO: This option isn't even tested here and is also not an option in V3...
		/**
		 * Test 7: Rule 12 cross-module ownership
		 * Tests allowAddApiOverwrite: false blocks cross-module, true allows
		 * Requires api.mutations.reload for moduleID tracking
		 */
		it("should handle cross-module ownership based on config", async () => {
			// Build addApi options based on config capabilities
			const addApiOptions = { moduleID: "original-module" };
			if (config.api?.mutations?.reload) {
				// Can use moduleID tracking
				await api.slothlet.api.add("funcTest", TEST_DIRS.API_TEST_MIXED, addApiOptions);
				const originalKeys = Object.keys(api.funcTest);

				// Different module tries to take over
				const shouldBlock = config.api?.mutations?.reload && config.allowAddApiOverwrite === false;

				if (shouldBlock) {
					// Rule 12 should block cross-module overwrite
					await withSuppressedSlothletErrorOutput(async () => {
						await expect(api.slothlet.api.add("funcTest", TEST_DIRS.API_TEST_CJS, { moduleID: "hostile-module" })).rejects.toThrow(
							"Rule 12"
						);
					});

					// Original preserved
					expect(Object.keys(api.funcTest)).toEqual(originalKeys);
				} else {
					// Should allow (either no ownership or allowAddApiOverwrite: true)
					await expect(api.slothlet.api.add("funcTest", TEST_DIRS.API_TEST_CJS, { moduleID: "new-owner-module" })).resolves.not.toThrow();
				}
			} else {
				// Without api.mutations.reload, no ownership tracking - just test basic api.slothlet.api.add
				await api.slothlet.api.add("funcTest", TEST_DIRS.API_TEST_MIXED);
				expect(api.funcTest).toBeDefined();

				// Can add more without moduleID concerns
				await api.slothlet.api.add("funcTest", TEST_DIRS.API_TEST_CJS);
				expect(Object.keys(api.funcTest).length).toBeGreaterThan(0);
			}
		});
	});
});
