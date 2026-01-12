/**
 * @fileoverview Test stack-trace-based path resolution in addApi calls
 *
 * @description
 * Tests that addApi correctly resolves relative paths when called through complex stack traces.
 * Specifically tests whether addApi can identify the correct base file for path resolution when
 * a closure is defined in one file but executed from a helper function in another file.
 *
 * Original test: tests/rewritten/test-actual-stack-scenario.mjs
 * Original test scenario: 1 test scenario across 6 ownership configs
 * New test scenario: 1 test scenario across all 20 matrix configs
 *
 * @module tests/vitests/processed/addapi/addapi-stack-trace-path.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, executeClosureFromDifferentFile, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("Stack Trace Path Resolution", () => {
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

		it("should resolve relative path from closure definition location, not execution location", async () => {
			// Build addApi options based on config capabilities
			const addApiOptions = { moduleId: "testModule" };
			if (config.hotReload) {
				addApiOptions.forceOverwrite = true;
			}

			// Define closure HERE in this test file
			// When executed through helper function, path should resolve relative to THIS file
			const testClosure = async (apiInstance) => {
				// This path is relative to THIS test file (tests/vitests/processed/addapi/addapi-stack-trace-path.test.vitest.mjs)
				// Should resolve to: tests/vitests/processed/addapi/../../../../api_tests/api_test_mixed = api_tests/api_test_mixed
				await apiInstance.addApi("test.path", "../../../../api_tests/api_test_mixed", {}, addApiOptions);
			};

			// Execute the closure through a helper function in a different file to create stack complexity
			await expect(executeClosureFromDifferentFile(api, testClosure)).resolves.not.toThrow();

			// Verify the API was actually loaded from the correct location
			expect(api.test).toBeDefined();
			expect(api.test.path).toBeDefined();

			// Verify specific API structure from api_test_mixed
			expect(typeof api.test.path).toBe("object");
		});
	});
});
