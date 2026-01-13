/**
 * @fileoverview Smart flattening tests - Case 1 (Single file) and Case 2 (Special addapi files).
 * @module smart-flattening-case1-case2.test.vitest
 *
 * @description
 * Tests Cases 1-2:
 * - Case 1: Single file matching API path (config.mjs -> avoid config.config)
 * - Case 2: Special addapi.* files (always flatten)
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

describe.each(TEST_MATRIX)("Smart Flattening Case 1-2 - $name", ({ name: ___name, config }) => {
	// ========================================================================
	// CASE 1: SINGLE FILE MATCHING API PATH
	// ========================================================================

	test("Single file matching API path - autoFlatten=true", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// Should flatten: api.config.{functions} not api.config.config.{functions}
		expect(typeof api.config.getConfig).toBe("function");
		expect(typeof api.config.setConfig).toBe("function");
		expect(typeof api.config.validateConfig).toBe("function");
		expect(api.config.config).toBeUndefined();

		// Test function execution
		await materialize(api.config.getConfig);
		const result = await api.config.getConfig();
		expect(result).toBe("config-value");

		await api.shutdown();
	});

	test("Single file matching API path - autoFlatten=false", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("config", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_single"), {});

		// Should flatten: Rule 7 auto-flattening always applies regardless of autoFlatten parameter
		expect(typeof api.config.getConfig).toBe("function");
		expect(api.config.config).toBeUndefined();

		// Test function execution
		await materialize(api.config.getConfig);
		const result = await api.config.getConfig();
		expect(result).toBe("config-value");

		await api.shutdown();
	});

	// ========================================================================
	// CASE 2: SPECIAL ADDAPI FILES
	// ========================================================================

	test("Special addapi.mjs file - autoFlatten=true", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("plugins", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_addapi"), {});

		// Should flatten: api.plugins.{functions} not api.plugins.addapi.{functions}
		expect(typeof api.plugins.initializePlugin).toBe("function");
		expect(typeof api.plugins.pluginMethod).toBe("function");
		expect(typeof api.plugins.cleanup).toBe("function");
		expect(api.plugins.addapi).toBeUndefined();

		// Test function execution
		await materialize(api.plugins.initializePlugin);
		const result = await api.plugins.initializePlugin();
		expect(result).toBe("Plugin initialized");

		await api.shutdown();
	});

	test("Special addapi.mjs file - autoFlatten=false", async () => {
		const api = await slothlet({
			...config,
			dir: path.join(__dirname, "../../../../api_tests/api_test")
		});

		await api.addApi("plugins", path.join(__dirname, "../../../../api_tests/smart_flatten/api_smart_flatten_addapi"), {});

		// Should still flatten addapi files even when autoFlatten=false (special case)
		expect(typeof api.plugins.initializePlugin).toBe("function");
		expect(api.plugins.addapi).toBeUndefined();

		await api.shutdown();
	});
});
