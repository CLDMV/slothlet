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

		await api.addApi("config", path.join(__dirname, "../api_tests/api_smart_flatten_single"), {}, true);

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

		await api.addApi("config", path.join(__dirname, "../api_tests/api_smart_flatten_single"), {}, false);

		// Should NOT flatten: api.config.config.{functions}
		assert(typeof api.config.config === "object", "Should have nested api.config.config");
		assert(typeof api.config.config.getConfig === "function", "getConfig should be under api.config.config");
		assert(typeof api.config.config.setConfig === "function", "setConfig should be under api.config.config");

		// Test function execution
		await materialize(api.config.config.getConfig);
		const result = await api.config.config.getConfig();
		assert(result === "config-value", "Function should execute correctly");

		await api.shutdown();
	});

	// ========================================================================
	// CASE 2: SPECIAL ADDAPI FILES
	// ========================================================================

	await runTest(`${modeLabel}: Special addapi.mjs file - autoFlatten=true`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("plugins", path.join(__dirname, "../api_tests/api_smart_flatten_addapi"), {}, true);

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

		await api.addApi("plugins", path.join(__dirname, "../api_tests/api_smart_flatten_addapi"), {}, false);

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

		await api.addApi("utils", path.join(__dirname, "../api_tests/api_smart_flatten_multiple"), {}, true);

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

		await api.addApi("utils", path.join(__dirname, "../api_tests/api_smart_flatten_multiple"), {}, false);

		// Should NOT flatten: api.utils.utils.{functions}
		assert(typeof api.utils.utils === "object", "Should have nested api.utils.utils");
		assert(typeof api.utils.utils.utilFunction === "function", "utilFunction should be under api.utils.utils");

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

		await api.addApi("services", path.join(__dirname, "../api_tests/api_smart_flatten_none"), {}, true);

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

		await api.addApi("services", path.join(__dirname, "../api_tests/api_smart_flatten_none"), {}, false);

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

		await api.addApi("config", path.join(__dirname, "../api_tests/api_smart_flatten_folder_config"), {}, true);

		// Root level files should be namespaced by filename
		assert(typeof api.config.main === "object", "main module should exist as namespace");
		assert(typeof api.config.main.getRootInfo === "function", "getRootInfo should be in main namespace");

		// Config subfolder should NOT be flattened (no matching file at root level)
		assert(typeof api.config.config === "object", "config subfolder should exist as api.config.config");
		assert(typeof api.config.config.getNestedConfig === "function", "getNestedConfig should be in subfolder");
		assert(typeof api.config.config.setNestedConfig === "function", "setNestedConfig should be in subfolder");

		// Test execution
		await materialize(api.config.main.getRootInfo);
		const rootResult = await api.config.main.getRootInfo();
		assert(rootResult === "root-level-function", "Root function should execute correctly");

		await materialize(api.config.config.getNestedConfig);
		const nestedResult = await api.config.config.getNestedConfig();
		assert(nestedResult === "nested-config-value", "Nested function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Folder with config subfolder containing different named files`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("config", path.join(__dirname, "../api_tests/api_smart_flatten_folder_different"), {}, true);

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

		await api.addApi("plugins", path.join(__dirname, "../api_tests/api_smart_flatten_addapi_with_folders"), {}, true);

		// Addapi.mjs contents should be flattened to root level
		assert(typeof api.plugins.initializeMainPlugin === "function", "initializeMainPlugin should be flattened to root");
		assert(typeof api.plugins.pluginGlobalMethod === "function", "pluginGlobalMethod should be flattened to root");
		assert(api.plugins.pluginVersion === "1.0.0", "pluginVersion should be flattened to root");

		// Subfolders should NOT be flattened (preserve structure)
		assert(typeof api.plugins.config === "object", "config subfolder should exist");
		assert(typeof api.plugins.utils === "object", "utils subfolder should exist");
		assert(typeof api.plugins.services === "object", "services subfolder should exist");

		// Config subfolder contents (files get namespaced by filename)
		assert(typeof api.plugins.config.settings === "object", "settings.mjs should be namespaced within config");
		assert(typeof api.plugins.config.settings.getPluginConfig === "function", "getPluginConfig should be in config.settings");

		// Utils subfolder contents (files get namespaced by filename)
		assert(typeof api.plugins.utils.helpers === "object", "helpers.mjs should be namespaced within utils");
		assert(typeof api.plugins.utils.helpers.formatPluginOutput === "function", "formatPluginOutput should be in utils.helpers");

		// Services subfolder contents (files get namespaced by filename)
		assert(typeof api.plugins.services.api === "object", "api.mjs should be namespaced within services");
		assert(typeof api.plugins.services.api.getPluginApiService === "function", "getPluginApiService should be in services.api");

		// Deep nested structure should be preserved (no recursive flattening)
		assert(typeof api.plugins.services.services === "object", "services.services should exist");
		assert(
			typeof api.plugins.services.services.services.getNestedPluginService === "function",
			"getNestedPluginService should be in services.services.services"
		);

		// Test execution
		await materialize(api.plugins.initializeMainPlugin);
		const initResult = await api.plugins.initializeMainPlugin();
		assert(initResult === "Main plugin initialized from addapi.mjs", "Main plugin function should execute correctly");

		await materialize(api.plugins.services.services.services.getNestedPluginService);
		const nestedResult = await api.plugins.services.services.services.getNestedPluginService();
		assert(nestedResult === "deeply-nested-plugin-service", "Deep nested function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Nested folders - no recursive flattening`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("nested", path.join(__dirname, "../api_tests/api_smart_flatten_nested"), {}, true);

		// Root level files should be namespaced by filename
		assert(typeof api.nested.root === "object", "root module should exist as namespace");
		assert(typeof api.nested.root.getRootFunction === "function", "getRootFunction should be in root namespace");

		// Services subfolder contents should preserve structure (api.mjs stays nested)
		assert(typeof api.nested.services.api === "object", "api.mjs should be nested under services subfolder");
		assert(typeof api.nested.services.api.getApiService === "function", "getApiService should be in services.api namespace");

		// services/services/services.mjs should flatten because folder name matches file name
		assert(typeof api.nested.services === "object", "services subfolder should exist for nested structure");
		assert(typeof api.nested.services.services === "object", "services.services should be flattened (folder=file name)");
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

		await api.addApi("deep.nested.config", path.join(__dirname, "../api_tests/api_smart_flatten_single"), {}, true);

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
		await api.addApi("area1.config", path.join(__dirname, "../api_tests/api_smart_flatten_single"), {}, true);

		// Second call without flattening
		await api.addApi("area2.config", path.join(__dirname, "../api_tests/api_smart_flatten_single"), {}, false);

		// area1 should be flattened
		assert(typeof api.area1.config.getConfig === "function", "area1.config should be flattened");
		assert(!api.area1.config.config, "area1 should NOT have config.config");

		// area2 should NOT be flattened
		assert(typeof api.area2.config.config === "object", "area2.config should have nested config");
		assert(typeof api.area2.config.config.getConfig === "function", "area2.config.config.getConfig should exist");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Function calls work correctly after flattening`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("functional", path.join(__dirname, "../api_tests/api_smart_flatten_multiple"), {}, true);

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
		await materialize(api.functional.validator.validate, true);
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
			dir: path.join(__dirname, "../api_tests/api_smart_flatten_single"),
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

		await addApiInstance.addApi("config", path.join(__dirname, "../api_tests/api_smart_flatten_single"), {}, true);

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

		await api.addApi("config", path.join(__dirname, "../api_tests/api_smart_flatten_folder_config"), {}, true);

		// Should have both root level files and config subfolder properly namespaced
		assert(typeof api.config.main === "object", "Should have main.mjs as 'main' namespace");
		assert(typeof api.config.main.getRootInfo === "function", "Should have root level function from main.mjs");
		assert(typeof api.config.config === "object", "Should have config subfolder as nested object");
		assert(typeof api.config.config.getNestedConfig === "function", "Should have config.mjs flattened within config subfolder");

		// Verify functions work
		await materialize(api.config.main.getRootInfo);
		const rootResult = await api.config.main.getRootInfo();
		assert(rootResult === "root-level-function", "Root function should execute correctly");

		await materialize(api.config.config.getNestedConfig);
		const nestedResult = await api.config.config.getNestedConfig();
		assert(nestedResult === "nested-config-value", "Nested function should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Folder with config subfolder containing different named files`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("config", path.join(__dirname, "../api_tests/api_smart_flatten_folder_different"), {}, true);

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

		await api.addApi("services", path.join(__dirname, "../api_tests/api_smart_flatten_nested"), {}, true);

		// Should have root level function properly namespaced
		assert(typeof api.services.root === "object", "Should have root.mjs as 'root' namespace");
		assert(typeof api.services.root.getRootFunction === "function", "Should have root level function");

		// Should have services subfolder contents preserve structure
		assert(typeof api.services.services.api === "object", "Should have api.mjs nested under services subfolder");
		assert(typeof api.services.services.api.getApiService === "function", "Should have api service function");

		// Should have services/services/services.mjs flattened due to name matching
		assert(typeof api.services.services === "object", "Should have services subfolder");
		assert(typeof api.services.services.services === "object", "Should have services.mjs flattened within services subfolder");
		assert(typeof api.services.services.services.getNestedService === "function", "Should have nested service function");

		// Verify functions work
		await materialize(api.services.root.getRootFunction);
		const rootResult = await api.services.root.getRootFunction();
		assert(rootResult === "root-function-data", "Root function should execute correctly");

		await materialize(api.services.services.api.getApiService);
		const apiResult = await api.services.services.api.getApiService();
		assert(apiResult === "api-service-function", "API service should execute correctly");

		await materialize(api.services.services.services.getNestedService);
		const nestedResult = await api.services.services.services.getNestedService();
		assert(nestedResult === "deeply-nested-service", "Nested service should execute correctly");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Verify flattening disabled with autoFlatten=false for folders`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		// Test with autoFlatten=false - should preserve exact structure
		await api.addApi("config", path.join(__dirname, "../api_tests/api_smart_flatten_folder_config"), {}, false);

		// Should NOT flatten - should preserve folder structure exactly
		assert(typeof api.config.main === "object", "Should have main file as object (not flattened)");
		assert(typeof api.config.main.getRootInfo === "function", "Should have getRootInfo under main object");
		assert(typeof api.config.config === "object", "Should have config subfolder");
		assert(typeof api.config.config.config === "object", "Should have config file under config subfolder");
		assert(typeof api.config.config.config.getNestedConfig === "function", "Should have nested function under preserved structure");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: AddApi with both files and folders - special handling`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("plugins", path.join(__dirname, "../api_tests/api_smart_flatten_addapi_with_folders"), {}, true);

		// Should flatten addapi content to root level
		assert(typeof api.plugins.initializeMainPlugin === "function", "Should have addapi.mjs contents flattened to root");
		assert(typeof api.plugins.pluginGlobalMethod === "function", "Should have addapi.mjs contents flattened to root");
		assert(api.plugins.pluginVersion === "1.0.0", "Should have addapi constant flattened to root");

		// Should preserve folder structure for non-addapi content
		assert(typeof api.plugins.config === "object", "Should have config subfolder");
		assert(typeof api.plugins.utils === "object", "Should have utils subfolder");
		assert(typeof api.plugins.services === "object", "Should have services subfolder");

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
