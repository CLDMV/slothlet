/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/addapi/addapi-stack-trace-path.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:46 -08:00 (1770266386)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test stack-trace-based path resolution in api.slothlet.api.add calls
 *
 * @description
 * Tests that api.slothlet.api.add correctly resolves relative paths when called through complex stack traces.
 * Specifically tests whether api.slothlet.api.add can identify the correct base file for path resolution when
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
import { getMatrixConfigs, executeClosureFromDifferentFile, TEST_DIRS, API_TEST_BASE } from "../../setup/vitest-helper.mjs";

describe("Stack Trace Path Resolution", () => {
	// Stack trace path resolution tests work across all configurations
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
			// Build api.slothlet.api.add options based on config capabilities
			const addApiOptions = { moduleId: "testModule" };
			if (config.hotReload) {
				addApiOptions.forceOverwrite = true;
			}

			// Define closure HERE in this test file
			// When executed through helper function, path should resolve relative to THIS file
			const testClosure = async (apiInstance) => {
				// This path is relative to THIS test file (tests/vitests/processed/addapi/addapi-stack-trace-path.test.vitest.mjs)
				// Should resolve to: tests/vitests/processed/addapi/../../../../${API_TEST_BASE}/api_test_mixed
				await apiInstance.slothlet.api.add("test.path", `../../../../${API_TEST_BASE}/api_test_mixed`, {}, addApiOptions);

				// Verify the API was actually loaded from the correct location
				expect(api.test).toBeDefined();
				expect(api.test.path).toBeDefined();

				// Verify specific API structure from api_test_mixed
				// Note: In LAZY mode, api.test.path is a callable proxy (typeof === 'function')
				// but still has the expected namespace properties. Check for properties instead.
				expect(api.test.path.mathCjs).toBeDefined();
				expect(api.test.path.mathEsm).toBeDefined();
				expect(api.test.path.interop).toBeDefined();
			};

			// Execute the closure through helper function in different file
			// This tests that path resolution uses closure definition location, not helper execution location
			await executeClosureFromDifferentFile(api, testClosure);
		});
	});
});
