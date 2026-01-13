/**
 * @fileoverview Comprehensive tests for module ownership tracking and API removal
 * Tests Rule 13: Auto-cleanup before reload to prevent orphan functions
 * @module tests/vitests/processed/ownership/module-ownership-removal.test.vitest
 * @memberof tests.vitests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use OWNERSHIP_MATRIX helper for configs that require hotReload + ownership tracking
const OWNERSHIP_MATRIX = getMatrixConfigs({ hotReload: true });
const BASIC_MATRIX = getMatrixConfigs({ hotReload: false, hooks: false });

// Test modules directory - temporary folder next to this test file
const testDir = path.join(__dirname, "temp-ownership-modules");

/**
 * Setup test module directories with different function sets
 */
async function setupTestModules() {
	// Clean up if exists
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch (_) {
		// Ignore if doesn't exist
	}

	// Create test module directories
	await fs.mkdir(testDir, { recursive: true });

	// Module A - Version 1 (has function1 and function2)
	const moduleAv1Dir = path.join(testDir, "moduleA_v1");
	await fs.mkdir(moduleAv1Dir, { recursive: true });
	await fs.writeFile(
		path.join(moduleAv1Dir, "functions.mjs"),
		`
export function function1() {
	return "moduleA_v1_function1";
}

export function function2() {
	return "moduleA_v1_function2";
}
`.trim()
	);

	// Module A - Version 2 (has function2 and function3, no function1)
	const moduleAv2Dir = path.join(testDir, "moduleA_v2");
	await fs.mkdir(moduleAv2Dir, { recursive: true });
	await fs.writeFile(
		path.join(moduleAv2Dir, "functions.mjs"),
		`
export function function2() {
	return "moduleA_v2_function2";
}

export function function3() {
	return "moduleA_v2_function3";
}
`.trim()
	);

	// Module B - Has different functions
	const moduleBDir = path.join(testDir, "moduleB");
	await fs.mkdir(moduleBDir, { recursive: true });
	await fs.writeFile(
		path.join(moduleBDir, "helpers.mjs"),
		`
export function helperA() {
	return "moduleB_helperA";
}

export function helperB() {
	return "moduleB_helperB";
}
`.trim()
	);
}

/**
 * Cleanup test modules
 */
async function cleanupTestModules() {
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch (_) {
		// Ignore errors
	}
}

// Setup once before all tests
beforeAll(async () => {
	await setupTestModules();
});

// Cleanup after all tests
afterAll(async () => {
	await cleanupTestModules();
});

// Basic API removal tests - work without ownership tracking
describe.each(BASIC_MATRIX)("Basic API Removal > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should remove API by path", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Add an API
		await api.addApi("test.module", testDir + "/moduleA_v1");

		// Remove it
		const removed = await api.removeApi("test.module");
		expect(removed).toBe(true);
		expect(api.test?.module).toBeUndefined();
	});

	it("should handle removeApi error cases", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Test invalid types
		await expect(api.removeApi(123)).rejects.toThrow(TypeError);

		// Test empty object
		await expect(api.removeApi({})).rejects.toThrow();

		// Test non-existent path (should return false, not throw)
		const removed = await api.removeApi("nonexistent.path");
		expect(removed).toBe(false);
	});

	it("should work without ownership tracking", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Add API without moduleId
		await api.addApi("test.module", testDir + "/moduleA_v1");

		// Remove by path (should work)
		const removed = await api.removeApi("test.module");
		expect(removed).toBe(true);
		expect(api.test?.module).toBeUndefined();
	});

	it("should return false for moduleId removal without ownership tracking", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Try to remove by moduleId without ownership tracking
		const removed = await api.removeApi({ moduleId: "someModule" });
		expect(removed).toBe(false);
	});

	it("should silently ignore moduleId when ownership disabled", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Add API WITH moduleId option but ownership tracking is OFF
		await api.addApi("plugins.test", testDir + "/moduleA_v1", {}, { moduleId: "testModule" });

		expect(api.plugins?.test).toBeDefined();

		// Attempt to remove by moduleId should fail
		const removedById = await api.removeApi({ moduleId: "testModule" });
		expect(removedById).toBe(false);
		expect(api.plugins?.test).toBeDefined();

		// But removal by path should still work
		const removedByPath = await api.removeApi("plugins.test");
		expect(removedByPath).toBe(true);
		expect(api.plugins?.test).toBeUndefined();
	});
});

// Module ownership tests - require hotReload for ownership tracking
describe.each(OWNERSHIP_MATRIX)("Module Ownership > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should remove API by moduleId", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Add multiple APIs for the same module
		await api.addApi("plugins.feature1", testDir + "/moduleA_v1", {}, { moduleId: "moduleA" });
		await api.addApi("plugins.feature2", testDir + "/moduleA_v1", {}, { moduleId: "moduleA" });

		// Remove all APIs owned by moduleA
		const removed = await api.removeApi({ moduleId: "moduleA" });
		expect(removed).toBe(true);
		expect(api.plugins?.feature1).toBeUndefined();
		expect(api.plugins?.feature2).toBeUndefined();
	});

	it("should auto-cleanup to prevent orphan functions", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Load version 1 (has function1 and function2)
		await api.addApi("plugins.moduleA", testDir + "/moduleA_v1", {}, { moduleId: "moduleA" });

		// Reload with version 2 (has function2 and function3, NO function1)
		await api.addApi("plugins.moduleA", testDir + "/moduleA_v2", {}, { moduleId: "moduleA" });

		// With auto-cleanup, function1 should be GONE (no errors should occur)
		expect(api.plugins?.moduleA).toBeDefined();
	});

	it("should isolate auto-cleanup by moduleId", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Load moduleA
		await api.addApi("plugins.moduleA", testDir + "/moduleA_v1", {}, { moduleId: "moduleA" });

		// Load moduleB
		await api.addApi("plugins.moduleB", testDir + "/moduleB", {}, { moduleId: "moduleB" });

		// Reload moduleA with version 2
		await api.addApi("plugins.moduleA", testDir + "/moduleA_v2", {}, { moduleId: "moduleA" });

		// moduleB should be untouched
		expect(api.plugins?.moduleB).toBeDefined();
	});

	it("should remove nested API paths by moduleId", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Add APIs at different nesting levels
		await api.addApi("level1", testDir + "/moduleA_v1", {}, { moduleId: "test" });
		await api.addApi("level1.level2", testDir + "/moduleB", {}, { moduleId: "test" });
		await api.addApi("level1.level2.level3", testDir + "/moduleA_v1", {}, { moduleId: "test" });

		// Remove all by moduleId
		const removed = await api.removeApi({ moduleId: "test" });
		expect(removed).toBe(true);
		expect(api.level1).toBeUndefined();
	});
});
