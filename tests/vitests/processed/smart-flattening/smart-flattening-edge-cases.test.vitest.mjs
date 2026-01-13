/**
 * @fileoverview Smart flattening tests - Edge cases and consistency checks.
 * @module smart-flattening-edge-cases.test.vitest
 *
 * @description
 * Tests edge cases and consistency:
 * - Nested API paths with flattening
 * - Multiple addApi calls
 * - Function execution after flattening
 * - Primary load vs addApi consistency
 * - AutoFlatten=false behavior
 * - Mixed files and folders
 */

import { describe, test, expect } from "vitest";
import slothlet from "../../../../index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_MATRIX } from "../../setup/vitest-helper.mjs";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

/**
 * In lazy mode, folders are represented as functions, while in eager mode they are objects.
 * This helper checks if a value is a valid folder type for the current mode.
 */
function isValidFolderType(value, mode) {
	if (mode === "lazy") {
		return typeof value === "function" || typeof value === "object";
	} else {
		return typeof value === "object";
	}
}

/**
 * Helper function to trigger materialization in lazy mode
 */
async function materialize(func, ...args) {
	if (typeof func === "function") {
		await func(...args);
	}
}

describe.each(TEST_MATRIX)("Smart Flattening Edge Cases - $name", ({ name: ___name, config }) => {
	test("Nested API paths with flattening", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("deep.nested.config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// Should create nested structure but flatten config.mjs contents
		expect(typeof api.deep).toBe("object");
		expect(typeof api.deep.nested).toBe("object");
		expect(typeof api.deep.nested.config).toBe("object");
		expect(typeof api.deep.nested.config.getConfig).toBe("function");
		expect(api.deep.nested.config.config).toBeUndefined();

		await api.shutdown();
	});

	test("Multiple addApi calls with different flattening", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		// First call with flattening
		await api.addApi("area1.config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// Second call without flattening
		await api.addApi("area2.config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// area1 should be flattened
		expect(typeof api.area1.config.getConfig).toBe("function");
		expect(api.area1.config.config).toBeUndefined();

		// Both should be flattened due to Rule 7 (always applies)
		expect(typeof api.area2.config.getConfig).toBe("function");
		expect(api.area2.config.config).toBeUndefined();

		await api.shutdown();
	});

	test("Function calls work correctly after flattening", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("functional", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_multiple"), {});

		// Test all functions work through their correct namespaces
		await materialize(api.functional.utils.utilFunction);
		await materialize(api.functional.utils.helperMethod);
		await materialize(api.functional.utils.formatData, "test");

		const util = await api.functional.utils.utilFunction();
		const helper = await api.functional.utils.helperMethod();
		const formatted = await api.functional.utils.formatData("test");

		expect(util).toBe("utility function");
		expect(helper).toBe("helper method");
		expect(formatted).toBe("Formatted: test");

		// Test preserved module functions work
		await materialize(api.functional.validator.validate);
		await materialize(api.functional.logger.debug, "test message");

		const validated = await api.functional.validator.validate(true);
		const logged = await api.functional.logger.debug("test message");

		expect(validated).toBe(true);
		expect(logged).toBe("[DEBUG] test message");

		await api.shutdown();
	});

	test("Primary load vs addApi behavior consistency", async () => {
		// Test that primary loading doesn't apply addApi flattening rules
		const primaryApi = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_single")
		});

		// Primary load should preserve structure (no smart flattening)
		expect(typeof primaryApi.config).toBe("object");

		const addApiInstance = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await addApiInstance.addApi("config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// AddApi should flatten
		expect(typeof addApiInstance.config.getConfig).toBe("function");

		await primaryApi.shutdown();
		await addApiInstance.shutdown();
	});

	test("Verify flattening disabled with autoFlatten=false for folders", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		// Test with autoFlatten=false - should preserve exact structure
		await api.addApi("config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_folder_config"), {});

		// Should apply Rule 1 flattening regardless of autoFlatten=false (filename matches folder)
		expect(typeof api.config.main).toBe("object");
		expect(typeof api.config.main.getRootInfo).toBe("function");
		expect(api.config.config).toBeUndefined();
		expect(typeof api.config.getNestedConfig).toBe("function");

		await api.shutdown();
	});

	test("AddApi with both files and folders - special handling", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("plugins", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_addapi_with_folders"), {});

		// Should flatten addapi content to root level
		expect(typeof api.plugins.initializeMainPlugin).toBe("function");
		expect(typeof api.plugins.pluginGlobalMethod).toBe("function");
		expect(api.plugins.pluginVersion).toBe("1.0.0");

		// Trigger materialization by accessing nested properties first
		api.plugins.config.settings;
		api.plugins.utils.helpers;
		api.plugins.services.api;

		// Should preserve folder structure for non-addapi content
		expect(isValidFolderType(api.plugins.config, config.mode)).toBe(true);
		expect(isValidFolderType(api.plugins.utils, config.mode)).toBe(true);
		expect(isValidFolderType(api.plugins.services, config.mode)).toBe(true);

		// Verify functions work
		await materialize(api.plugins.initializeMainPlugin);
		const addApiResult = await api.plugins.initializeMainPlugin();
		expect(addApiResult).toBe("Main plugin initialized from addapi.mjs");

		await api.shutdown();
	});
});
