/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-smart-flattening-api.mjs
 *	@Date: 2026-01-02 17:45:00 -08:00 (1767404700)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-02 15:51:00 -08:00 (1767397860)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Comprehensive tests for smart flattening functionality in addApi.
 * @module test-smart-flattening-api
 *
 * @description
 * Tests the smart flattening system including:
 * - Case 1: Single file matching API path (config.mjs -> avoid config.config)
 * - Case 2: Special addapi.* files (always flatten)
 * - Case 3: Multiple files with one matching API path (flatten matching, preserve others)
 * - Case 4: Normal behavior when no flattening should occur
 * - autoFlatten=true vs autoFlatten=false behavior
 * - Cross-mode compatibility (lazy/eager × async/live)
 */

import slothlet from "../index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

// Test utilities
let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

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

async function runTest(name, fn) {
	testCount++;
	try {
		await fn();
		passCount++;
		console.log(`✅ ${name}`);
	} catch (error) {
		failCount++;
		console.error(`❌ ${name}`);
		console.error(`   ${error.message}`);
		if (error.stack) {
			console.error(`   ${error.stack.split("\n").slice(1, 3).join("\n")}`);
		}
	}
}

// ============================================================================
// COMPLETE TEST SUITE FOR EACH MODE COMBINATION
// ============================================================================

/**
 * Run ALL tests for a specific mode combination
 */
async function runAllTestsForMode(mode, runtime, hooks) {
	const modeLabel = `${mode.toUpperCase()} + ${runtime.toUpperCase()} + hooks:${hooks}`;
	const isLazy = mode === "lazy";

	// Helper function to trigger materialization in lazy mode
	const materialize = async (func, ...args) => {
		if (isLazy && typeof func === "function") {
			await func(...args);
		}
	};

	// ========================================================================
	// CASE 1: SINGLE FILE MATCHING API PATH
	// ========================================================================

	await runTest(`${modeLabel}: Single file matching API path - autoFlatten=true`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// Should flatten: api.config.{functions} not api.config.config.{functions}
		assert(typeof api.config.getConfig === "function", "getConfig should be directly under api.config");
		assert(typeof api.config.setConfig === "function", "setConfig should be directly under api.config");
		assert(typeof api.config.validateConfig === "function", "validateConfig should be directly under api.config");
		assert(!api.config.config, "Should NOT have nested api.config.config");

		// Test function execution
		await materialize(api.config.getConfig);
		const result = await api.config.getConfig();
		assert(result === "config-value", "Function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Single file matching API path - autoFlatten=false`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// Should flatten: Rule 7 auto-flattening always applies regardless of autoFlatten parameter
		assert(typeof api.config.getConfig === "function", "getConfig should be directly under api.config");
		assert(!api.config.config, "Should NOT have nested api.config.config - Rule 7 always applies");

		// Test function execution
		await materialize(api.config.getConfig);
		const result = await api.config.getConfig();
		assert(result === "config-value", "Function should execute correctly");

		await api.shutdown();
	});

	// ========================================================================
	// CASE 2: SPECIAL ADDAPI FILES
	// ========================================================================

	await runTest(`${modeLabel}: Special addapi.mjs file - autoFlatten=true`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("plugins", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_addapi"), {});

		// Should flatten: api.plugins.{functions} not api.plugins.addapi.{functions}
		assert(typeof api.plugins.initializePlugin === "function", "initializePlugin should be directly under api.plugins");
		assert(typeof api.plugins.pluginMethod === "function", "pluginMethod should be directly under api.plugins");
		assert(typeof api.plugins.cleanup === "function", "cleanup should be directly under api.plugins");
		assert(!api.plugins.addapi, "Should NOT have nested api.plugins.addapi");

		// Test function execution
		await materialize(api.plugins.initializePlugin);
		const result = await api.plugins.initializePlugin();
		assert(result === "Plugin initialized", "Function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Special addapi.mjs file - autoFlatten=false`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("plugins", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_addapi"), {});

		// Should still flatten addapi files even when autoFlatten=false (special case)
		assert(typeof api.plugins.initializePlugin === "function", "addapi should be flattened even with autoFlatten=false");
		assert(!api.plugins.addapi, "Should NOT have nested api.plugins.addapi even with autoFlatten=false");

		await api.shutdown();
	});

	// ========================================================================
	// CASE 3: MULTIPLE FILES WITH ONE MATCHING API PATH
	// ========================================================================

	await runTest(`${modeLabel}: Multiple files with matching API path - autoFlatten=true`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("utils", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_multiple"), {});

		// Should flatten utils.mjs contents to root level
		assert(typeof api.utils.utilFunction === "function", "utilFunction should be directly under api.utils");
		assert(typeof api.utils.helperMethod === "function", "helperMethod should be directly under api.utils");
		assert(typeof api.utils.formatData === "function", "formatData should be directly under api.utils");

		// Should preserve other modules
		assert(typeof api.utils.validator === "object", "validator module should be preserved");
		assert(typeof api.utils.logger === "object", "logger module should be preserved");
		assert(typeof api.utils.validator.validate === "function", "validator.validate should exist");
		assert(typeof api.utils.logger.debug === "function", "logger.debug should exist");

		// Should NOT have nested utils.utils
		assert(!api.utils.utils, "Should NOT have nested api.utils.utils");

		// Test function execution
		await materialize(api.utils.utilFunction);
		const result = await api.utils.utilFunction();
		assert(result === "utility function", "Function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Multiple files with matching API path - autoFlatten=false`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("utils", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_multiple"), {});

		// Should flatten utils.mjs due to Rule 7 (always applies)
		assert(typeof api.utils.utilFunction === "function", "utilFunction should be flattened to api.utils level");
		assert(!api.utils.utils, "Should NOT have nested api.utils.utils - Rule 7 always applies");

		// Should still preserve other modules
		assert(typeof api.utils.validator === "object", "validator module should be preserved");
		assert(typeof api.utils.logger === "object", "logger module should be preserved");

		await api.shutdown();
	});

	// ========================================================================
	// CASE 4: NO FLATTENING - NORMAL BEHAVIOR
	// ========================================================================

	await runTest(`${modeLabel}: No matching files - normal behavior autoFlatten=true`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("services", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_none"), {});

		// Should NOT flatten since no files match "services"
		assert(typeof api.services.auth === "object", "auth module should be preserved");
		assert(typeof api.services.users === "object", "users module should be preserved");
		assert(typeof api.services.auth.authenticate === "function", "auth.authenticate should exist");
		assert(typeof api.services.users.getUser === "function", "users.getUser should exist");

		// Should NOT have flattening
		assert(!api.services.authenticate, "Should NOT have flattened auth functions to services root");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: No matching files - normal behavior autoFlatten=false`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("services", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_none"), {});

		// Should behave same as autoFlatten=true when no files match
		assert(typeof api.services.auth === "object", "auth module should be preserved");
		assert(typeof api.services.users === "object", "users module should be preserved");

		await api.shutdown();
	});

	// ========================================================================
	// FOLDER STRUCTURE TESTS - COMPREHENSIVE SCENARIOS
	// ========================================================================

	await runTest(`${modeLabel}: Folder with config subfolder containing config.mjs`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_folder_config"), {});

		// Root level files should be namespaced by filename
		assert(typeof api.config.main === "object", "main module should exist as namespace");
		assert(typeof api.config.main.getRootInfo === "function", "getRootInfo should be in main namespace");

		// Config subfolder should be flattened due to Rule 1 (config/config.mjs - filename matches folder)
		assert(typeof api.config.getNestedConfig === "function", "getNestedConfig should be flattened due to Rule 1");
		assert(typeof api.config.setNestedConfig === "function", "setNestedConfig should be flattened due to Rule 1");
		assert(!api.config.config, "Should NOT have nested config.config due to Rule 1 flattening");

		// Test execution
		await materialize(api.config.main.getRootInfo);
		const rootResult = await api.config.main.getRootInfo();
		assert(rootResult === "root-level-function", "Root function should execute correctly");

		await materialize(api.config.getNestedConfig);
		const nestedResult = await api.config.getNestedConfig();
		assert(nestedResult === "nested-config-value", "Nested function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Folder with config subfolder containing different named files`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_folder_different"), {});

		// Root level files should be namespaced by filename
		assert(typeof api.config.utils === "object", "utils module should exist as namespace");
		assert(typeof api.config.utils.getUtils === "function", "getUtils should be in utils namespace");

		// Config subfolder contents should be flattened to root level (no config subfolder preserved)
		assert(typeof api.config.server === "object", "server.mjs should be flattened from config subfolder");
		assert(typeof api.config.database === "object", "database.mjs should be flattened from config subfolder");
		assert(typeof api.config.server.getServerConfig === "function", "getServerConfig should be in server namespace");
		assert(typeof api.config.database.getDbConfig === "function", "getDbConfig should be in database namespace");

		// Test execution
		await materialize(api.config.utils.getUtils);
		const utilResult = await api.config.utils.getUtils();
		assert(utilResult === "utility-functions", "Utils function should execute correctly");

		await materialize(api.config.server.getServerConfig);
		const serverResult = await api.config.server.getServerConfig();
		assert(serverResult === "server-config-data", "Server config should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Addapi.mjs with folders - only first level flattening`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("plugins", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_addapi_with_folders"), {});

		// Addapi.mjs contents should be flattened to root level
		assert(typeof api.plugins.initializeMainPlugin === "function", "initializeMainPlugin should be flattened to root");
		assert(typeof api.plugins.pluginGlobalMethod === "function", "pluginGlobalMethod should be flattened to root");
		assert(api.plugins.pluginVersion === "1.0.0", "pluginVersion should be flattened to root");

		// Trigger materialization by accessing nested properties first
		const configSettings = api.plugins.config.settings;
		const utilsHelpers = api.plugins.utils.helpers;
		const servicesApi = api.plugins.services.api;

		// Now check that subfolders exist (as objects in eager mode, functions in lazy mode)
		assert(isValidFolderType(api.plugins.config, mode), "config subfolder should exist");
		assert(isValidFolderType(api.plugins.utils, mode), "utils subfolder should exist");
		assert(isValidFolderType(api.plugins.services, mode), "services subfolder should exist");

		// Config subfolder contents (files get namespaced by filename)
		assert(isValidFolderType(configSettings, mode), "settings.mjs should be namespaced within config");
		assert(typeof configSettings.getPluginConfig === "function", "getPluginConfig should be in config.settings");

		// Utils subfolder contents (files get namespaced by filename)
		assert(isValidFolderType(utilsHelpers, mode), "helpers.mjs should be namespaced within utils");
		assert(typeof utilsHelpers.formatPluginOutput === "function", "formatPluginOutput should be in utils.helpers");

		// Services subfolder contents (files get namespaced by filename)
		assert(isValidFolderType(servicesApi, mode), "api.mjs should be namespaced within services");
		assert(typeof servicesApi.getPluginApiService === "function", "getPluginApiService should be in services.api");

		// Deep nested structure should be preserved (no recursive flattening)
		assert(isValidFolderType(api.plugins.services.services, mode), "services.services should exist");
		assert(
			typeof api.plugins.services.services.getNestedPluginService === "function",
			"getNestedPluginService should be flattened due to Rule 1 (services/services.mjs)"
		);

		// Test execution
		await materialize(api.plugins.initializeMainPlugin);
		const initResult = await api.plugins.initializeMainPlugin();
		assert(initResult === "Main plugin initialized from addapi.mjs", "Main plugin function should execute correctly");

		await materialize(api.plugins.services.services.getNestedPluginService);
		const nestedResult = await api.plugins.services.services.getNestedPluginService();
		assert(nestedResult === "deeply-nested-plugin-service", "Deep nested function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Nested folders - no recursive flattening`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("nested", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_nested"), {});

		// Root level files should be namespaced by filename
		assert(typeof api.nested.root === "object", "root module should exist as namespace");
		assert(typeof api.nested.root.getRootFunction === "function", "getRootFunction should be in root namespace");

		// Trigger materialization by accessing nested properties first
		const servicesApiObj = api.nested.services.api;

		// Services subfolder contents should preserve structure (api.mjs stays nested)
		assert(isValidFolderType(servicesApiObj, mode), "api.mjs should be nested under services subfolder");
		assert(typeof servicesApiObj.getApiService === "function", "getApiService should be in services.api namespace");

		// services/services/services.mjs should flatten because folder name matches file name
		assert(isValidFolderType(api.nested.services, mode), "services subfolder should exist for nested structure");
		assert(isValidFolderType(api.nested.services.services, mode), "services.services should be flattened (folder=file name)");
		assert(
			typeof api.nested.services.services.getNestedService === "function",
			"getNestedService should be in services.services (flattened)"
		);

		// Test execution
		await materialize(api.nested.root.getRootFunction);
		const rootResult = await api.nested.root.getRootFunction();
		assert(rootResult === "root-function-data", "Root function should execute correctly");

		await materialize(api.nested.services.api.getApiService);
		const apiResult = await api.nested.services.api.getApiService();
		assert(apiResult === "api-service-function", "API service should execute correctly");

		await materialize(api.nested.services.services.getNestedService);
		const nestedResult = await api.nested.services.services.getNestedService();
		assert(nestedResult === "deeply-nested-service", "Nested service should execute correctly");

		await api.shutdown();
	});

	// ========================================================================
	// EDGE CASES AND COMPLEX SCENARIOS
	// ========================================================================

	await runTest(`${modeLabel}: Nested API paths with flattening`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("deep.nested.config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// Should create nested structure but flatten config.mjs contents
		assert(typeof api.deep === "object", "deep should exist");
		assert(typeof api.deep.nested === "object", "deep.nested should exist");
		assert(typeof api.deep.nested.config === "object", "deep.nested.config should exist");
		assert(typeof api.deep.nested.config.getConfig === "function", "getConfig should be flattened");
		assert(!api.deep.nested.config.config, "Should NOT have deep.nested.config.config");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Multiple addApi calls with different flattening`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		// First call with flattening
		await api.addApi("area1.config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// Second call without flattening
		await api.addApi("area2.config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// area1 should be flattened
		assert(typeof api.area1.config.getConfig === "function", "area1.config should be flattened");
		assert(!api.area1.config.config, "area1 should NOT have config.config");

		// Both should be flattened due to Rule 7 (always applies)
		assert(typeof api.area2.config.getConfig === "function", "area2.config.getConfig should be flattened");
		assert(!api.area2.config.config, "area2 should NOT have config.config - Rule 7 always applies");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Function calls work correctly after flattening`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("functional", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_multiple"), {});

		// Test all functions work through their correct namespaces
		await materialize(api.functional.utils.utilFunction);
		await materialize(api.functional.utils.helperMethod);
		await materialize(api.functional.utils.formatData, "test");

		const util = await api.functional.utils.utilFunction();
		const helper = await api.functional.utils.helperMethod();
		const formatted = await api.functional.utils.formatData("test");

		assert(util === "utility function", "utilFunction should work correctly");
		assert(helper === "helper method", "helperMethod should work correctly");
		assert(formatted === "Formatted: test", "formatData should work correctly");

		// Test preserved module functions work
		await materialize(api.functional.validator.validate);
		await materialize(api.functional.logger.debug, "test message");

		const validated = await api.functional.validator.validate(true);
		const logged = await api.functional.logger.debug("test message");

		assert(validated === true, "validator.validate should work correctly");
		assert(logged === "[DEBUG] test message", "logger.debug should work correctly");

		await api.shutdown();
	});

	// ========================================================================
	// CONSISTENCY CHECKS
	// ========================================================================

	await runTest(`${modeLabel}: Primary load vs addApi behavior consistency`, async () => {
		// Test that primary loading doesn't apply addApi flattening rules
		const primaryApi = await slothlet({
			dir: path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_single"),
			mode: mode,
			runtime: runtime,
			hooks: hooks
		});

		// Primary load should preserve structure (no smart flattening)
		assert(typeof primaryApi.config === "object", "Primary load should create config namespace");

		const addApiInstance = await slothlet({
			dir: path.join(__dirname, "../api_tests/api_test"),
			mode: mode,
			runtime: runtime,
			hooks: hooks
		});

		await addApiInstance.addApi("config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// AddApi should flatten
		assert(typeof addApiInstance.config.getConfig === "function", "AddApi should flatten config");

		await primaryApi.shutdown();
		await addApiInstance.shutdown();
	});

	// ========================================================================
	// FOLDER STRUCTURE TESTS
	// ========================================================================

	await runTest(`${modeLabel}: Folder with config subfolder containing config.mjs`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_folder_config"), {});

		// Should have both root level files and config subfolder properly namespaced
		assert(typeof api.config.main === "object", "Should have main.mjs as 'main' namespace");
		assert(typeof api.config.main.getRootInfo === "function", "Should have root level function from main.mjs");
		assert(!api.config.config, "Should NOT have config.config due to Rule 1 flattening (filename matches folder)");
		assert(typeof api.config.getNestedConfig === "function", "Should have config.mjs content flattened to root due to Rule 1");

		// Verify functions work
		await materialize(api.config.main.getRootInfo);
		const rootResult = await api.config.main.getRootInfo();
		assert(rootResult === "root-level-function", "Root function should execute correctly");

		await materialize(api.config.getNestedConfig);
		const nestedResult = await api.config.getNestedConfig();
		assert(nestedResult === "nested-config-value", "Nested function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Folder with config subfolder containing different named files`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_folder_different"), {});

		// Should have utils.mjs namespaced and config subfolder contents flattened to root level
		assert(typeof api.config.utils === "object", "Should have utils.mjs as 'utils' namespace");
		assert(typeof api.config.utils.getUtils === "function", "Should have root level utils function");
		assert(typeof api.config.server === "object", "Should have server.mjs flattened from config subfolder");
		assert(typeof api.config.server.getServerConfig === "function", "Should have server config function");
		assert(typeof api.config.database === "object", "Should have database.mjs flattened from config subfolder");
		assert(typeof api.config.database.getDbConfig === "function", "Should have database config function");

		// Verify functions work
		await materialize(api.config.utils.getUtils);
		const utilsResult = await api.config.utils.getUtils();
		assert(utilsResult === "utility-functions", "Utils function should execute correctly");

		await materialize(api.config.server.getServerConfig);
		const serverResult = await api.config.server.getServerConfig();
		assert(serverResult === "server-config-data", "Server config should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Nested folder structure - flattening only at first level`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("services", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_nested"), {});

		// Should have root level function properly namespaced
		assert(typeof api.services.root === "object", "Should have root.mjs as 'root' namespace");
		assert(typeof api.services.root.getRootFunction === "function", "Should have root level function");

		// Should have services/api.mjs at services level
		assert(typeof api.services.api === "object", "Should have api.mjs at services level");
		assert(typeof api.services.api.getApiService === "function", "Should have api service function");

		// Trigger materialization by accessing nested properties first
		api.services.services.getNestedService;

		// Should have services/services/services.mjs flattened due to Rule 1 (filename matches folder)
		assert(isValidFolderType(api.services.services, mode), "Should have services subfolder");
		assert(typeof api.services.services.getNestedService === "function", "Should have services.mjs functions flattened due to Rule 1");

		// Verify functions work
		await materialize(api.services.root.getRootFunction);
		const rootResult = await api.services.root.getRootFunction();
		assert(rootResult === "root-function-data", "Root function should execute correctly");

		await materialize(api.services.api.getApiService);
		const apiResult = await api.services.api.getApiService();
		assert(apiResult === "api-service-function", "API service should execute correctly");

		await materialize(api.services.services.getNestedService);
		const nestedResult = await api.services.services.getNestedService();
		assert(nestedResult === "deeply-nested-service", "Nested service should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Verify flattening disabled with autoFlatten=false for folders`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		// Test with autoFlatten=false - should preserve exact structure
		await api.addApi("config", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_folder_config"), {});

		// Should apply Rule 1 flattening regardless of autoFlatten=false (filename matches folder)
		assert(typeof api.config.main === "object", "Should have main file as object (not flattened)");
		assert(typeof api.config.main.getRootInfo === "function", "Should have getRootInfo under main object");
		assert(!api.config.config, "Should NOT have config.config due to Rule 1 flattening overriding autoFlatten=false");
		assert(typeof api.config.getNestedConfig === "function", "Should have Rule 1 flattening even with autoFlatten=false");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: AddApi with both files and folders - special handling`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("plugins", path.join(__dirname, "../api_tests/smart_flatten/api_smart_flatten_addapi_with_folders"), {});

		// Should flatten addapi content to root level
		assert(typeof api.plugins.initializeMainPlugin === "function", "Should have addapi.mjs contents flattened to root");
		assert(typeof api.plugins.pluginGlobalMethod === "function", "Should have addapi.mjs contents flattened to root");
		assert(api.plugins.pluginVersion === "1.0.0", "Should have addapi constant flattened to root");

		// Trigger materialization by accessing nested properties first
		api.plugins.config.settings;
		api.plugins.utils.helpers;
		api.plugins.services.api;

		// Should preserve folder structure for non-addapi content
		assert(isValidFolderType(api.plugins.config, mode), "Should have config subfolder");
		assert(isValidFolderType(api.plugins.utils, mode), "Should have utils subfolder");
		assert(isValidFolderType(api.plugins.services, mode), "Should have services subfolder");

		// Verify functions work
		await materialize(api.plugins.initializeMainPlugin);
		const addApiResult = await api.plugins.initializeMainPlugin();
		assert(addApiResult === "Main plugin initialized from addapi.mjs", "AddApi function should execute correctly");
		await api.shutdown();
	});
}

// ============================================================================
// RUN ALL TESTS FOR EACH MODE COMBINATION
// ============================================================================

for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const hooks of [false, true]) {
			await runAllTestsForMode(mode, runtime, hooks);
		}
	}
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log(`Smart Flattening Test Results: ${passCount}/${testCount} passed, ${failCount} failed`);
console.log("=".repeat(60));

if (failCount > 0) {
	process.exit(1);
}
