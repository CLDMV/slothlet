/**
 * @fileoverview Test api.slothlet.api.add path resolution from different call stack depths
 *
 * @description
 * Tests that api.slothlet.api.add resolves paths correctly regardless of:
 * - Call stack depth (direct call vs through helper functions)
 * - Helper function location (same file, different file, nested)
 * - Working directory changes
 *
 * Original test: tests/test-addapi-path-resolution.mjs
 * Original test count: 9 path resolution tests
 * New test count: 9 tests × 20 matrix configs = 180 tests
 *
 * @module tests/vitests/processed/addapi/addapi-path-resolution.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, API_TEST_BASE } from "../../setup/vitest-helper.mjs";

describe("api.slothlet.api.add Path Resolution", () => {
	let api;

	/**
	 * Helper function in the same file - simulates passing api.slothlet.api.add through a layer
	 */
	async function helperInSameFile(api, path, metadata, options) {
		return await api.slothlet.api.add("helper.same", path, metadata, options);
	}

	/**
	 * Deeply nested helper - simulates multiple layers
	 */
	async function deeplyNestedHelper(api, path, metadata, options) {
		async function innerHelper(api, path, metadata, options) {
			return await api.slothlet.api.add("helper.nested", path, metadata, options);
		}
		return await innerHelper(api, path, metadata, options);
	}

	describe.each(getMatrixConfigs({}))("Config: $name", ({ config }) => {
		afterEach(async () => {
			if (api && typeof api.shutdown === "function") {
				await api.shutdown();
			}
			api = null;
		});

		beforeEach(async () => {
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST });
		});
		/**
		 * Test 1: Direct api.slothlet.api.add call from test file
		 */
		it("should resolve paths correctly for direct api.slothlet.api.add call", async () => {
			await api.slothlet.api.add("direct.test", `../../../../${API_TEST_BASE}/api_test_mixed`);
			expect(api.direct).toBeDefined();
			expect(api.direct.test).toBeDefined();
		});

		/**
		 * Test 2: Call through helper function in same file
		 */
		it("should resolve paths correctly through same-file helper", async () => {
			await helperInSameFile(api, `../../../../${API_TEST_BASE}/api_test_collections`, {}, {});
			expect(api.helper).toBeDefined();
			expect(api.helper.same).toBeDefined();
		});

		/**
		 * Test 3: Call through deeply nested helper
		 */
		it("should resolve paths correctly through deeply nested helper", async () => {
			await deeplyNestedHelper(api, `../../../../${API_TEST_BASE}/api_test_mixed`, {}, {});
			expect(api.helper).toBeDefined();
			expect(api.helper.nested).toBeDefined();
		});

		/**
		 * Test 4: Call through imported helper from different file
		 */
		it("should resolve paths correctly through imported helper", async () => {
			// Import dynamically to test resolution
			const { runTestWithApi } = await import("../../setup/vitest-helper.mjs");
			await runTestWithApi(api, async (api) => {
				await api.slothlet.api.add("imported.helper", `../../../../${API_TEST_BASE}/api_test`, {}, {});
			});
			expect(api.imported).toBeDefined();
			expect(api.imported.helper).toBeDefined();
		});

		/**
		 * Test 5: Call through helper in nested directory
		 */
		it("should resolve paths correctly through nested directory helper", async () => {
			const { executeWithApi } = await import("../../../nested/helper-executor.mjs");
			await executeWithApi(api, async (api) => {
				await api.slothlet.api.add("nested.dir.helper", `../../../../${API_TEST_BASE}/api_test_collections`, {}, {});
			});
			expect(api.nested).toBeDefined();
			expect(api.nested.dir).toBeDefined();
			expect(api.nested.dir.helper).toBeDefined();
		});

		/**
		 * Test 6: Direct api.slothlet.api.add call FROM nested directory file
		 * Tests that when the api.slothlet.api.add call itself is IN the nested file,
		 * the path should resolve relative to that nested file's location
		 */
		it("should resolve paths correctly for direct call FROM nested directory file", async () => {
			const { addApiFromNested } = await import("../../../nested/helper-executor.mjs");
			// Note: The nested helper should handle its own path resolution
			// Use deeper relative path since this is called from nested helper
			await addApiFromNested(api, "nested.direct", `../../${API_TEST_BASE}/api_test_mixed`, {}, {});
			expect(api.nested).toBeDefined();
			expect(api.nested.direct).toBeDefined();
		});

		/**
		 * Test 7: Double-nested call (closure through nested helper that calls another function)
		 */
		it("should resolve paths correctly for double-nested closure call", async () => {
			const { executeWithApi } = await import("../../../nested/helper-executor.mjs");
			// Call through nested helper, which calls helperInSameFile, which calls api.slothlet.api.add
			await executeWithApi(api, async (api) => {
				await helperInSameFile(api, `../../../../${API_TEST_BASE}/api_test`, {}, {});
			});
			expect(api.helper).toBeDefined();
			expect(api.helper.same).toBeDefined();
		});

		/**
		 * Test 8: Call through nested helper with deeply nested function call
		 */
		it("should resolve paths correctly for nested helper with deep function nesting", async () => {
			const { executeWithApi } = await import("../../../nested/helper-executor.mjs");
			await executeWithApi(api, async (api) => {
				await deeplyNestedHelper(api, `../../../../${API_TEST_BASE}/api_test_mixed`, {}, {});
			});
			expect(api.helper).toBeDefined();
			expect(api.helper.nested).toBeDefined();
		});

		/**
		 * Test 9: Chain through vitest-helper.mjs then nested helper
		 */
		it("should resolve paths correctly through chained helpers", async () => {
			const { runTestWithApi } = await import("../../setup/vitest-helper.mjs");
			const { executeWithApi } = await import("../../../nested/helper-executor.mjs");
			await runTestWithApi(api, async (api) => {
				await executeWithApi(api, async (api) => {
					await api.slothlet.api.add("chain.test", `../../../../${API_TEST_BASE}/api_test_collections`, {}, {});
				});
			});
			expect(api.chain).toBeDefined();
			expect(api.chain.test).toBeDefined();
		});
	});
});
