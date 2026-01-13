/**
 * @fileoverview Smart flattening tests - Folder structure scenarios.
 * @module smart-flattening-folders.test.vitest
 *
 * @description
 * Tests folder structure scenarios:
 * - Folders with matching subfolders
 * - Addapi files with folders
 * - Nested folder structures
 * - AutoFlatten behavior with folders
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

describe.each(TEST_MATRIX)("Smart Flattening Folders - $name", ({ name: ___name, config }) => {
	test("Folder with config subfolder containing config.mjs", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_folder_config"), {});

		// Root level files should be namespaced by filename
		expect(typeof api.config.main).toBe("object");
		expect(typeof api.config.main.getRootInfo).toBe("function");

		// Config subfolder should be flattened due to Rule 1 (config/config.mjs - filename matches folder)
		expect(typeof api.config.getNestedConfig).toBe("function");
		expect(typeof api.config.setNestedConfig).toBe("function");
		expect(api.config.config).toBeUndefined();

		// Test execution
		await materialize(api.config.main.getRootInfo);
		const rootResult = await api.config.main.getRootInfo();
		expect(rootResult).toBe("root-level-function");

		await materialize(api.config.getNestedConfig);
		const nestedResult = await api.config.getNestedConfig();
		expect(nestedResult).toBe("nested-config-value");

		await api.shutdown();
	});

	test("Folder with config subfolder containing different named files", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_folder_different"), {});

		// Root level files should be namespaced by filename
		expect(typeof api.config.utils).toBe("object");
		expect(typeof api.config.utils.getUtils).toBe("function");

		// Config subfolder contents should be flattened to root level (no config subfolder preserved)
		expect(typeof api.config.server).toBe("object");
		expect(typeof api.config.database).toBe("object");
		expect(typeof api.config.server.getServerConfig).toBe("function");
		expect(typeof api.config.database.getDbConfig).toBe("function");

		// Test execution
		await materialize(api.config.utils.getUtils);
		const utilResult = await api.config.utils.getUtils();
		expect(utilResult).toBe("utility-functions");

		await materialize(api.config.server.getServerConfig);
		const serverResult = await api.config.server.getServerConfig();
		expect(serverResult).toBe("server-config-data");

		await api.shutdown();
	});

	test("Addapi.mjs with folders - only first level flattening", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("plugins", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_addapi_with_folders"), {});

		// Addapi.mjs contents should be flattened to root level
		expect(typeof api.plugins.initializeMainPlugin).toBe("function");
		expect(typeof api.plugins.pluginGlobalMethod).toBe("function");
		expect(api.plugins.pluginVersion).toBe("1.0.0");

		// Trigger materialization by accessing nested properties first
		const configSettings = api.plugins.config.settings;
		const utilsHelpers = api.plugins.utils.helpers;
		const servicesApi = api.plugins.services.api;

		// Now check that subfolders exist (as objects in eager mode, functions in lazy mode)
		expect(isValidFolderType(api.plugins.config, config.mode)).toBe(true);
		expect(isValidFolderType(api.plugins.utils, config.mode)).toBe(true);
		expect(isValidFolderType(api.plugins.services, config.mode)).toBe(true);

		// Config subfolder contents (files get namespaced by filename)
		expect(isValidFolderType(configSettings, config.mode)).toBe(true);
		expect(typeof configSettings.getPluginConfig).toBe("function");

		// Utils subfolder contents (files get namespaced by filename)
		expect(isValidFolderType(utilsHelpers, config.mode)).toBe(true);
		expect(typeof utilsHelpers.formatPluginOutput).toBe("function");

		// Services subfolder contents (files get namespaced by filename)
		expect(isValidFolderType(servicesApi, config.mode)).toBe(true);
		expect(typeof servicesApi.getPluginApiService).toBe("function");

		// Deep nested structure should be preserved (no recursive flattening)
		expect(isValidFolderType(api.plugins.services.services, config.mode)).toBe(true);
		expect(typeof api.plugins.services.services.getNestedPluginService).toBe("function");

		// Test execution
		await materialize(api.plugins.initializeMainPlugin);
		const initResult = await api.plugins.initializeMainPlugin();
		expect(initResult).toBe("Main plugin initialized from addapi.mjs");

		await materialize(api.plugins.services.services.getNestedPluginService);
		const nestedResult = await api.plugins.services.services.getNestedPluginService();
		expect(nestedResult).toBe("deeply-nested-plugin-service");

		await api.shutdown();
	});

	test("Nested folders - no recursive flattening", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("nested", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_nested"), {});

		// Root level files should be namespaced by filename
		expect(typeof api.nested.root).toBe("object");
		expect(typeof api.nested.root.getRootFunction).toBe("function");

		// Trigger materialization by accessing nested properties first
		const servicesApiObj = api.nested.services.api;

		// Services subfolder contents should preserve structure (api.mjs stays nested)
		expect(isValidFolderType(servicesApiObj, config.mode)).toBe(true);
		expect(typeof servicesApiObj.getApiService).toBe("function");

		// services/services/services.mjs should flatten because folder name matches file name
		expect(isValidFolderType(api.nested.services, config.mode)).toBe(true);
		expect(isValidFolderType(api.nested.services.services, config.mode)).toBe(true);
		expect(typeof api.nested.services.services.getNestedService).toBe("function");

		// Test execution
		await materialize(api.nested.root.getRootFunction);
		const rootResult = await api.nested.root.getRootFunction();
		expect(rootResult).toBe("root-function-data");

		await materialize(api.nested.services.api.getApiService);
		const apiResult = await api.nested.services.api.getApiService();
		expect(apiResult).toBe("api-service-function");

		await materialize(api.nested.services.services.getNestedService);
		const nestedResult = await api.nested.services.services.getNestedService();
		expect(nestedResult).toBe("deeply-nested-service");

		await api.shutdown();
	});

	test("Folder with config subfolder containing config.mjs (duplicate)", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_folder_config"), {});

		// Should have both root level files and config subfolder properly namespaced
		expect(typeof api.config.main).toBe("object");
		expect(typeof api.config.main.getRootInfo).toBe("function");
		expect(api.config.config).toBeUndefined();
		expect(typeof api.config.getNestedConfig).toBe("function");

		// Verify functions work
		await materialize(api.config.main.getRootInfo);
		const rootResult = await api.config.main.getRootInfo();
		expect(rootResult).toBe("root-level-function");

		await materialize(api.config.getNestedConfig);
		const nestedResult = await api.config.getNestedConfig();
		expect(nestedResult).toBe("nested-config-value");

		await api.shutdown();
	});

	test("Folder with config subfolder containing different named files (duplicate)", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_folder_different"), {});

		// Should have utils.mjs namespaced and config subfolder contents flattened to root level
		expect(typeof api.config.utils).toBe("object");
		expect(typeof api.config.utils.getUtils).toBe("function");
		expect(typeof api.config.server).toBe("object");
		expect(typeof api.config.server.getServerConfig).toBe("function");
		expect(typeof api.config.database).toBe("object");
		expect(typeof api.config.database.getDbConfig).toBe("function");

		// Verify functions work
		await materialize(api.config.utils.getUtils);
		const utilsResult = await api.config.utils.getUtils();
		expect(utilsResult).toBe("utility-functions");

		await materialize(api.config.server.getServerConfig);
		const serverResult = await api.config.server.getServerConfig();
		expect(serverResult).toBe("server-config-data");

		await api.shutdown();
	});

	test("Nested folder structure - flattening only at first level (duplicate)", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("services", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_nested"), {});

		// Should have root level function properly namespaced
		expect(typeof api.services.root).toBe("object");
		expect(typeof api.services.root.getRootFunction).toBe("function");

		// Should have services/api.mjs at services level
		expect(typeof api.services.api).toBe("object");
		expect(typeof api.services.api.getApiService).toBe("function");

		// Trigger materialization by accessing nested properties first
		api.services.services.getNestedService;

		// Should have services/services/services.mjs flattened due to Rule 1 (filename matches folder)
		expect(isValidFolderType(api.services.services, config.mode)).toBe(true);
		expect(typeof api.services.services.getNestedService).toBe("function");

		// Verify functions work
		await materialize(api.services.root.getRootFunction);
		const rootResult = await api.services.root.getRootFunction();
		expect(rootResult).toBe("root-function-data");

		await materialize(api.services.api.getApiService);
		const apiResult = await api.services.api.getApiService();
		expect(apiResult).toBe("api-service-function");

		await materialize(api.services.services.getNestedService);
		const nestedResult = await api.services.services.getNestedService();
		expect(nestedResult).toBe("deeply-nested-service");

		await api.shutdown();
	});
});
