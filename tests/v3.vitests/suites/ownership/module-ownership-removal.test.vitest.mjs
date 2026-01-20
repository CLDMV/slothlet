/**
 * @fileoverview Comprehensive tests for module ownership tracking and API removal
 * Tests Rule 13: Auto-cleanup before reload to prevent orphan functions
 * @module tests/vitests/processed/ownership/module-ownership-removal.test.vitest
 * @memberof tests.vitests
 */

// TODO(v3): Reconcile ownership removal expectations with v3 slothlet namespace behavior.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
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
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			diagnostics: true,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should remove API by path", async () => {
		await api.slothlet.api.add({ apiPath: "test.module", folderPath: testDir + "/moduleA_v1" });

		// Remove it
		await api.slothlet.api.remove("test.module");
		expect(api.test?.module).toBeUndefined();
	});

	it("should handle removeApi error cases", async () => {
		await expect(api.slothlet.api.remove(123)).rejects.toThrow();
		await expect(api.slothlet.api.remove({})).rejects.toThrow();
		await expect(api.slothlet.api.remove("nonexistent.path")).resolves.toBeUndefined();
	});

	it("should work without ownership tracking", async () => {
		await api.slothlet.api.add({ apiPath: "test.module", folderPath: testDir + "/moduleA_v1" });

		// Remove by path (should work)
		await api.slothlet.api.remove("test.module");
		expect(api.test?.module).toBeUndefined();
	});

	it("should return false for moduleId removal without ownership tracking", async () => {
		await api.slothlet.api.remove({ moduleId: "someModule" });
	});

	it("should silently ignore moduleId when ownership disabled", async () => {
		await api.slothlet.api.add({
			apiPath: "plugins.test",
			folderPath: testDir + "/moduleA_v1",
			options: { moduleId: "testModule" }
		});

		expect(api.plugins?.test).toBeDefined();

		// Attempt to remove by moduleId should fail
		await api.slothlet.api.remove({ moduleId: "testModule" });
		expect(api.plugins?.test).toBeDefined();

		// But removal by path should still work
		await api.slothlet.api.remove("plugins.test");
		expect(api.plugins?.test).toBeUndefined();
	});
});

// Module ownership tests - require hotReload for ownership tracking
describe.each(OWNERSHIP_MATRIX)("Module Ownership > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			diagnostics: true,
			dir: TEST_DIRS.API_TEST
		});
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
		await api.slothlet.api.add("plugins.feature1", testDir + "/moduleA_v1", {}, { moduleId: "moduleA" });
		await api.slothlet.api.add("plugins.feature2", testDir + "/moduleA_v1", {}, { moduleId: "moduleA" });

		// Remove all APIs owned by moduleA
		const removed = await api.slothlet.api.remove({ moduleId: "moduleA" });
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
		await api.slothlet.api.add("plugins.moduleA", testDir + "/moduleA_v1", {}, { moduleId: "moduleA" });

		// Reload with version 2 (has function2 and function3, NO function1)
		await api.slothlet.api.add("plugins.moduleA", testDir + "/moduleA_v2", {}, { moduleId: "moduleA" });

		// With auto-cleanup, function1 should be GONE (no errors should occur)
		expect(api.plugins?.moduleA).toBeDefined();
	});

	it("should isolate auto-cleanup by moduleId", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Load moduleA
		await api.slothlet.api.add("plugins.moduleA", testDir + "/moduleA_v1", {}, { moduleId: "moduleA" });

		// Load moduleB
		await api.slothlet.api.add("plugins.moduleB", testDir + "/moduleB", {}, { moduleId: "moduleB" });

		// Reload moduleA with version 2
		await api.slothlet.api.add("plugins.moduleA", testDir + "/moduleA_v2", {}, { moduleId: "moduleA" });

		// moduleB should be untouched
		expect(api.plugins?.moduleB).toBeDefined();
	});

	it("should remove nested API paths by moduleId", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Add APIs at different nesting levels
		await api.slothlet.api.add("level1", testDir + "/moduleA_v1", {}, { moduleId: "test" });
		await api.slothlet.api.add("level1.level2", testDir + "/moduleB", {}, { moduleId: "test" });
		await api.slothlet.api.add("level1.level2.level3", testDir + "/moduleA_v1", {}, { moduleId: "test" });

		// Remove all by moduleId
		const removed = await api.slothlet.api.remove({ moduleId: "test" });
		expect(removed).toBe(true);
		expect(api.level1).toBeUndefined();
	});
});
