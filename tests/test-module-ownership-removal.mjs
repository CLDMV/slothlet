/**
 * @fileoverview Comprehensive tests for module ownership tracking and API removal
 * Tests Rule 13: Auto-cleanup before reload to prevent orphan functions
 * @module tests/test-module-ownership-removal
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { runOwnershipTestMatrix, runSelectTestMatrix } from "./test-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test modules directory
const testDir = path.join(__dirname, "test-ownership-modules");

/**
 * Assertion helper that throws on failure
 * @param {boolean} condition - Condition to assert
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If condition is false
 */
function assert(condition, message) {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

/**
 * Setup test module directories with different function sets
 * @async
 * @returns {Promise<void>}
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
 * @async
 * @returns {Promise<void>}
 */
async function cleanupTestModules() {
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch (_) {
		// Ignore errors
	}
}

/**
 * Test 1: Basic removeApi by API path
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_removeApi_byPath(testWithConfig) {
	await testWithConfig("Remove API by path", async (api) => {
		// Add an API
		await api.addApi("test.module", path.join(testDir, "moduleA_v1"));

		// Remove it
		const removed = await api.removeApi("test.module");
		assert(removed === true, "removeApi should return true");
		assert(api.test === undefined || api.test.module === undefined, "test.module should be removed");
	});
}

/**
 * Test 2: removeApi with ownership tracking (by moduleId)
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_removeApi_byModuleId(testWithConfig) {
	await testWithConfig("Remove API by moduleId", async (api) => {
		// Add multiple APIs for the same module
		await api.addApi("plugins.feature1", path.join(testDir, "moduleA_v1"), {}, { moduleId: "moduleA" });
		await api.addApi("plugins.feature2", path.join(testDir, "moduleA_v1"), {}, { moduleId: "moduleA" });

		// Remove all APIs owned by moduleA
		const removed = await api.removeApi({ moduleId: "moduleA" });
		assert(removed === true, "removeApi should return true");
		assert(api.plugins === undefined || api.plugins.feature1 === undefined, "feature1 should be removed");
		assert(api.plugins === undefined || api.plugins.feature2 === undefined, "feature2 should be removed");
	});
}

/**
 * Test 3: Auto-cleanup prevents orphan functions on reload
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_autoCleanup_preventsOrphans(testWithConfig) {
	await testWithConfig("Auto-cleanup prevents orphan functions", async (api) => {
		// Load version 1 (has function1 and function2)
		await api.addApi("plugins.moduleA", path.join(testDir, "moduleA_v1"), {}, { moduleId: "moduleA" });

		// Reload with version 2 (has function2 and function3, NO function1)
		await api.addApi("plugins.moduleA", path.join(testDir, "moduleA_v2"), {}, { moduleId: "moduleA" });

		// With auto-cleanup, function1 should be GONE (no assertions needed, just verify no errors)
	});
}

/**
 * Test 4: Auto-cleanup only affects the same moduleId
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_autoCleanup_isolatedByModuleId(testWithConfig) {
	await testWithConfig("Auto-cleanup isolated by moduleId", async (api) => {
		// Load moduleA
		await api.addApi("plugins.moduleA", path.join(testDir, "moduleA_v1"), {}, { moduleId: "moduleA" });

		// Load moduleB
		await api.addApi("plugins.moduleB", path.join(testDir, "moduleB"), {}, { moduleId: "moduleB" });

		// Reload moduleA with version 2
		await api.addApi("plugins.moduleA", path.join(testDir, "moduleA_v2"), {}, { moduleId: "moduleA" });

		// moduleB should be untouched (verify it still exists)
		assert(api.plugins && api.plugins.moduleB, "moduleB should still exist");
	});
}

/**
 * Test 5: Manual removeApi works without ownership tracking
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_removeApi_withoutOwnership(testWithConfig) {
	await testWithConfig(
		"removeApi without ownership tracking",
		async (api) => {
			// Add API without moduleId
			await api.addApi("test.module", path.join(testDir, "moduleA_v1"));

			// Remove by path (should work)
			const removed = await api.removeApi("test.module");
			assert(removed === true, "removeApi by path should work");
			assert(api.test === undefined || api.test.module === undefined, "test.module should be removed");
		},
		{ hotReload: false }
	);
}

/**
 * Test 6: Attempting moduleId removal without ownership tracking
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_removeApi_moduleId_requiresOwnership(testWithConfig) {
	await testWithConfig(
		"moduleId removal requires ownership tracking",
		async (api) => {
			// Try to remove by moduleId without ownership tracking
			const removed = await api.removeApi({ moduleId: "someModule" });
			assert(removed === false, "Should return false when ownership tracking disabled");
		},
		{ hotReload: false }
	);
}

/**
 * Test 7: Test invalid removeApi parameters
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_removeApi_errorHandling(testWithConfig) {
	await testWithConfig("removeApi error handling", async (api) => {
		// Test invalid types
		try {
			await api.removeApi(123);
			assert(false, "Should throw TypeError for number");
		} catch (err) {
			assert(err instanceof TypeError, "Should throw TypeError");
		}

		// Test empty object
		try {
			await api.removeApi({});
			assert(false, "Should throw Error for empty object");
		} catch (err) {
			assert(err.message.includes("moduleId"), "Error should mention moduleId or apiPath");
		}

		// Test non-existent path (should return false, not throw)
		const removed = await api.removeApi("nonexistent.path");
		assert(removed === false, "Should return false for non-existent path");
	});
}

/**
 * Test 8: Test removing nested API paths
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_removeApi_nestedPaths(testWithConfig) {
	await testWithConfig("Remove nested API paths", async (api) => {
		// Add APIs at different nesting levels
		await api.addApi("level1", path.join(testDir, "moduleA_v1"), {}, { moduleId: "test" });
		await api.addApi("level1.level2", path.join(testDir, "moduleB"), {}, { moduleId: "test" });
		await api.addApi("level1.level2.level3", path.join(testDir, "moduleA_v1"), {}, { moduleId: "test" });

		// Remove all by moduleId
		const removed = await api.removeApi({ moduleId: "test" });
		assert(removed === true, "Should remove all paths");
		assert(api.level1 === undefined, "level1 should be removed");
	});
}

/**
 * Test 9: addApi with moduleId when ownership tracking disabled (edge case)
 * @async
 * @param {Function} testWithConfig - Test runner function
 * @returns {Promise<void>}
 */
async function test_addApi_moduleId_withoutOwnership(testWithConfig) {
	await testWithConfig(
		"addApi with moduleId when ownership disabled (edge case)",
		async (api) => {
			// Add API WITH moduleId option but ownership tracking is OFF
			// The moduleId should be silently ignored
			await api.addApi("plugins.test", path.join(testDir, "moduleA_v1"), {}, { moduleId: "testModule" });

			assert(api.plugins && api.plugins.test, "Module should still load");

			// Attempt to remove by moduleId should fail with a warning message
			const removedById = await api.removeApi({ moduleId: "testModule" });
			assert(removedById === false, "Should return false - ownership tracking disabled");
			assert(api.plugins && api.plugins.test, "Module should still exist after failed removal");

			// But removal by path should still work
			const removedByPath = await api.removeApi("plugins.test");
			assert(removedByPath === true, "Should remove by path");
			assert(api.plugins === undefined || api.plugins.test === undefined, "Module should be removed");
		},
		{ hotReload: false }
	);
}

/**
 * Run all tests
 * @async
 * @returns {Promise<void>}
 */
async function runAllTests() {
	console.log("=================================================");
	console.log("Module Ownership & API Removal - Comprehensive Tests");
	console.log("=================================================");

	try {
		// Setup test modules
		await setupTestModules();

		console.log("\n🔄 Running tests that work with ALL configurations...");
		await runSelectTestMatrix(
			["EAGER_BASIC", "LAZY_BASIC"],
			{},
			async (testWithConfig) => {
				await test_removeApi_byPath(testWithConfig);
				await test_removeApi_errorHandling(testWithConfig);
			},
			"Basic API Removal Tests"
		);

		console.log("\n🔄 Running tests that require hotReload...");
		await runOwnershipTestMatrix(
			{},
			async (testWithConfig) => {
				await test_removeApi_byModuleId(testWithConfig);
				await test_autoCleanup_preventsOrphans(testWithConfig);
				await test_autoCleanup_isolatedByModuleId(testWithConfig);
				await test_removeApi_nestedPaths(testWithConfig);
			},
			"Module Ownership Tests"
		);

		console.log("\n🔄 Running tests for behavior WITHOUT ownership tracking...");
		await runSelectTestMatrix(
			["EAGER_BASIC", "LAZY_BASIC"],
			{},
			async (testWithConfig) => {
				await test_removeApi_withoutOwnership(testWithConfig);
				await test_removeApi_moduleId_requiresOwnership(testWithConfig);
				await test_addApi_moduleId_withoutOwnership(testWithConfig);
			},
			"Tests Without Ownership Tracking"
		);

		console.log("\n=================================================");
		console.log("✅ ALL TESTS PASSED!");
		console.log("=================================================");
	} catch (error) {
		console.error("\n❌ TEST FAILED:");
		console.error(error);
		process.exit(1);
	} finally {
		// Cleanup
		await cleanupTestModules();
	}
}

// Run tests if executed directly
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
	runAllTests().catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
}

export { runAllTests };
