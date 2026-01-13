/**
 * @fileoverview Smart flattening tests - Case 3 (Multiple files) and Case 4 (No flattening).
 * @module smart-flattening-case3-case4.test.vitest
 *
 * @description
 * Tests Cases 3-4:
 * - Case 3: Multiple files with one matching API path (flatten matching, preserve others)
 * - Case 4: Normal behavior when no flattening should occur
 */

import { describe, test, expect } from "vitest";
import slothlet from "../../../../index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_MATRIX } from "../../setup/vitest-helper.mjs";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

/**
 * Helper function to trigger materialization in lazy mode
 */
async function materialize(func, ...args) {
	if (typeof func === "function") {
		await func(...args);
	}
}

describe.each(TEST_MATRIX)("Smart Flattening Case 3-4 - $name", ({ name: ___name, config }) => {
	// ========================================================================
	// CASE 3: MULTIPLE FILES WITH ONE MATCHING API PATH
	// ========================================================================

	test("Multiple files with matching API path - autoFlatten=true", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("utils", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_multiple"), {});

		// Should flatten utils.mjs contents to root level
		expect(typeof api.utils.utilFunction).toBe("function");
		expect(typeof api.utils.helperMethod).toBe("function");
		expect(typeof api.utils.formatData).toBe("function");

		// Should preserve other modules
		expect(typeof api.utils.validator).toBe("object");
		expect(typeof api.utils.logger).toBe("object");
		expect(typeof api.utils.validator.validate).toBe("function");
		expect(typeof api.utils.logger.debug).toBe("function");

		// Should NOT have nested utils.utils
		expect(api.utils.utils).toBeUndefined();

		// Test function execution
		await materialize(api.utils.utilFunction);
		const result = await api.utils.utilFunction();
		expect(result).toBe("utility function");

		await api.shutdown();
	});

	test("Multiple files with matching API path - autoFlatten=false", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("utils", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_multiple"), {});

		// Should flatten utils.mjs due to Rule 7 (always applies)
		expect(typeof api.utils.utilFunction).toBe("function");
		expect(api.utils.utils).toBeUndefined();

		// Should still preserve other modules
		expect(typeof api.utils.validator).toBe("object");
		expect(typeof api.utils.logger).toBe("object");

		await api.shutdown();
	});

	// ========================================================================
	// CASE 4: NO FLATTENING - NORMAL BEHAVIOR
	// ========================================================================

	test("No matching files - normal behavior autoFlatten=true", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("services", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_none"), {});

		// Should NOT flatten since no files match "services"
		expect(typeof api.services.auth).toBe("object");
		expect(typeof api.services.users).toBe("object");
		expect(typeof api.services.auth.authenticate).toBe("function");
		expect(typeof api.services.users.getUser).toBe("function");

		// Should NOT have flattening
		expect(api.services.authenticate).toBeUndefined();

		await api.shutdown();
	});

	test("No matching files - normal behavior autoFlatten=false", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("services", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_none"), {});

		// Should behave same as autoFlatten=true when no files match
		expect(typeof api.services.auth).toBe("object");
		expect(typeof api.services.users).toBe("object");

		await api.shutdown();
	});
});
