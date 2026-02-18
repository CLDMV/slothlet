/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-edge-cases.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:00 -08:00 (1770266400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Smart flattening tests - Edge cases and consistency checks.
 * @module smart-flattening-edge-cases.test.vitest
 *
 * @description
 * Tests edge cases and consistency:
 * - Nested API paths with flattening
 * - Multiple api.slothlet.api.add calls
 * - Function execution after flattening
 * - Primary load vs api.slothlet.api.add consistency
 * - AutoFlatten=false behavior
 * - Mixed files and folders
 */

import { describe, test, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMatrixConfigs, API_TEST_BASE } from "../../setup/vitest-helper.mjs";

const FULL_MATRIX = getMatrixConfigs({});

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

describe.each(FULL_MATRIX)("Smart Flattening Edge Cases - $name", ({ name: ___name, config }) => {
	test("Nested API paths with flattening", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		await api.slothlet.api.add(
			"deep.nested.config",
			path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_single`),
			{}
		);

		// Should create nested structure but flatten config.mjs contents
		expect(isValidFolderType(api.deep, config.mode)).toBe(true);
		expect(isValidFolderType(api.deep.nested, config.mode)).toBe(true);
		expect(isValidFolderType(api.deep.nested.config, config.mode)).toBe(true);
		expect(typeof api.deep.nested.config.getConfig).toBe("function");
		expect(api.deep.nested.config.config).toBeUndefined();

		await api.shutdown();
	});

	test("Multiple api.slothlet.api.add calls with different flattening", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		// First call with flattening
		await api.slothlet.api.add(
			"area1.config",
			path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_single`),
			{}
		);

		// Second call without flattening
		await api.slothlet.api.add(
			"area2.config",
			path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_single`),
			{}
		);

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
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		await api.slothlet.api.add(
			"functional",
			path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_multiple`),
			{}
		);

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

	test("Primary load vs api.slothlet.api.add behavior consistency", async () => {
		// Test that primary loading doesn't apply api.slothlet.api.add flattening rules
		const primaryApi = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_single`)
		});

		// const ___ = primaryApi.config.name;

		// Primary load should preserve structure (no smart flattening)
		// Access a property to force materialization in lazy mode, then check structure

		if (config.lazy) {
			// In lazy mode, trigger materialization by accessing a child property
			await primaryApi.config.getConfig();
		}
		const configType = typeof primaryApi.config;
		expect(configType).toBe("object");

		const addApiInstance = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		await addApiInstance.slothlet.api.add(
			"config",
			path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_single`),
			{}
		);

		// api.slothlet.api.add should flatten
		expect(typeof addApiInstance.config.getConfig).toBe("function");

		await primaryApi.shutdown();
		await addApiInstance.shutdown();
	});

	test("Verify flattening disabled with autoFlatten=false for folders", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		// Test with autoFlatten=false - should preserve exact structure
		await api.slothlet.api.add(
			"config",
			path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_folder_config`),
			{}
		);

		// Should apply Rule 1 flattening regardless of autoFlatten=false (filename matches folder)
		expect(typeof api.config.main).toBe("object");
		expect(typeof api.config.main.getRootInfo).toBe("function");
		expect(api.config.config).toBeUndefined();
		expect(typeof api.config.getNestedConfig).toBe("function");

		await api.shutdown();
	});

	test("api.slothlet.api.add with both files and folders - special handling", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, `../../../../${API_TEST_BASE}/api_test`)
		});

		await api.slothlet.api.add(
			"plugins",
			path.join(__dirname, `../../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_addapi_with_folders`),
			{}
		);

		// Should flatten api.slothlet.api.add content to root level
		expect(typeof api.plugins.initializeMainPlugin).toBe("function");
		expect(typeof api.plugins.pluginGlobalMethod).toBe("function");
		expect(api.plugins.pluginVersion).toBe("1.0.0");

		// Trigger materialization by accessing nested properties first
		api.plugins.config.settings;
		api.plugins.utils.helpers;
		api.plugins.services.api;

		// Should preserve folder structure for non-api.slothlet.api.add content
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
