/**
 * @fileoverview Comprehensive addApi path resolution testing
 * @module test-addapi-path-resolution
 * @description
 * Tests that addApi resolves paths correctly regardless of:
 * - Call stack depth (direct call vs through helper functions)
 * - Helper function location (same file, different file, nested)
 * - Working directory changes
 */

import { pathToFileURL } from "url";
import slothlet from "../index.mjs";

/**
 * Helper function in the same file - simulates passing addApi through a layer
 * @private
 */
async function helperInSameFile(api, path, metadata, options) {
	return await api.addApi("helper.same", path, metadata, options);
}

/**
 * Deeply nested helper - simulates multiple layers
 * @private
 */
async function deeplyNestedHelper(api, path, metadata, options) {
	// Another layer
	async function innerHelper(api, path, metadata, options) {
		return await api.addApi("helper.nested", path, metadata, options);
	}
	return await innerHelper(api, path, metadata, options);
}

/**
 * Test path resolution from different call depths
 * @public
 */
async function testPathResolution() {
	console.log("🧪 Testing addApi path resolution from different call depths...\n");

	const api = await slothlet({
		dir: "./api_tests/api_test",
		lazy: false,
		debug: false
	});

	let passed = 0;
	let failed = 0;
	const errors = [];

	// Test 1: Direct addApi call from test file
	console.log("📋 Test 1: Direct addApi call");
	try {
		await api.addApi("direct.test", "../api_tests/api_test_mixed");
		if (api.direct && api.direct.test) {
			console.log("   ✅ PASSED: Direct call resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Direct call", error: error.message });
	}

	// Test 2: Call through helper function in same file
	console.log("\n📋 Test 2: Call through same-file helper");
	try {
		await helperInSameFile(api, "../api_tests/api_test_collections", {}, {});
		if (api.helper && api.helper.same) {
			console.log("   ✅ PASSED: Same-file helper resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Same-file helper", error: error.message });
	}

	// Test 3: Call through deeply nested helper
	console.log("\n📋 Test 3: Call through deeply nested helper");
	try {
		await deeplyNestedHelper(api, "../api_tests/api_test_mixed", {}, {});
		if (api.helper && api.helper.nested) {
			console.log("   ✅ PASSED: Nested helper resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Nested helper", error: error.message });
	}

	// Test 4: Call through imported helper from different file
	console.log("\n📋 Test 4: Call through imported helper (test-helper.mjs)");
	try {
		// Import dynamically to test resolution
		const { runTestWithApi } = await import("./test-helper.mjs");
		await runTestWithApi(api, async (api) => {
			await api.addApi("imported.helper", "../api_tests/api_test", {}, {});
		});
		if (api.imported && api.imported.helper) {
			console.log("   ✅ PASSED: Imported helper resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Imported helper", error: error.message });
	}

	// Test 5: Call through helper in nested directory (tests/nested/)
	console.log("\n📋 Test 5: Call through nested directory helper");
	try {
		const { executeWithApi } = await import("./nested/helper-executor.mjs");
		await executeWithApi(api, async (api) => {
			await api.addApi("nested.dir.helper", "../api_tests/api_test_collections", {}, {});
		});
		if (api.nested && api.nested.dir && api.nested.dir.helper) {
			console.log("   ✅ PASSED: Nested directory helper resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Nested directory helper", error: error.message });
	}

	// Test 6: Direct addApi call FROM nested directory helper
	// This tests that when the addApi call itself is IN the nested file,
	// the path should resolve relative to that nested file's location
	console.log("\n📋 Test 6: Direct call FROM nested directory file");
	try {
		const { addApiFromNested } = await import("./nested/helper-executor.mjs");
		// Path must be relative to tests/nested/ location, so ../../api_tests/
		await addApiFromNested(api, "nested.direct", "../../api_tests/api_test_mixed", {}, {});
		if (api.nested && api.nested.direct) {
			console.log("   ✅ PASSED: Direct call from nested file resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Direct nested call", error: error.message });
	}

	// Test 7: Double-nested call (closure through nested helper that calls another function)
	console.log("\n📋 Test 7: Double-nested closure call");
	try {
		const { executeWithApi } = await import("./nested/helper-executor.mjs");
		// Call through nested helper, which calls helperInSameFile, which calls addApi
		await executeWithApi(api, async (api) => {
			await helperInSameFile(api, "../api_tests/api_test", {}, {});
		});
		if (api.helper && api.helper.same) {
			console.log("   ✅ PASSED: Double-nested closure resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Double-nested closure", error: error.message });
	}

	// Test 8: Call through nested helper with deeply nested function call
	console.log("\n📋 Test 8: Nested helper with deeply nested function");
	try {
		const { executeWithApi } = await import("./nested/helper-executor.mjs");
		await executeWithApi(api, async (api) => {
			await deeplyNestedHelper(api, "../api_tests/api_test_mixed", {}, {});
		});
		if (api.helper && api.helper.nested) {
			console.log("   ✅ PASSED: Nested helper with deep nesting resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Nested helper + deep nesting", error: error.message });
	}

	// Test 9: Chain through test-helper.mjs then nested helper
	console.log("\n📋 Test 9: Chain through test-helper then nested helper");
	try {
		const { runTestWithApi } = await import("./test-helper.mjs");
		const { executeWithApi } = await import("./nested/helper-executor.mjs");
		await runTestWithApi(api, async (api) => {
			await executeWithApi(api, async (api) => {
				await api.addApi("chain.test", "../api_tests/api_test_collections", {}, {});
			});
		});
		if (api.chain && api.chain.test) {
			console.log("   ✅ PASSED: Chained helpers resolved correctly");
			passed++;
		} else {
			throw new Error("API not loaded");
		}
	} catch (error) {
		console.log(`   ❌ FAILED: ${error.message}`);
		failed++;
		errors.push({ test: "Chained helpers", error: error.message });
	}

	await api.shutdown();

	// Summary
	console.log("\n" + "=".repeat(60));
	console.log("🎯 PATH RESOLUTION TEST SUMMARY");
	console.log("=".repeat(60));
	console.log(`Total Tests: ${passed + failed}`);
	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed}`);
	console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

	if (failed > 0) {
		console.log("\n❌ Failed tests:");
		errors.forEach(({ test, error }) => {
			console.log(`   - ${test}: ${error}`);
		});
		return false;
	} else {
		console.log("\n✅ All path resolution tests passed!");
		return true;
	}
}

// Run if executed directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const success = await testPathResolution();
	if (!success) {
		process.exit(1);
	}
}

export { testPathResolution };
