/**
 * @fileoverview Test for dynamic API extension using addApi method
 * @module test-add-api
 * @description
 * Tests the addApi functionality to verify:
 * - Loading modules from a new folder
 * - Merging them at a specified dotted path
 * - Working with both lazy and eager modes
 * - Proper live binding updates
 */

import slothlet from "../index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test addApi with eager mode
 * @async
 * @returns {Promise<void>}
 */
async function test_addApi_eager() {
	console.log("\n🔍 Testing addApi with EAGER mode");

	// Create initial API with eager mode
	const api = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: false,
		debug: true
	});

	console.log("\n[TEST] Initial API structure:");
	console.log("  - api.math:", typeof api.math);
	console.log("  - api.string:", typeof api.string);

	// Add new API at runtime.newapi path
	console.log("\n[TEST] Adding new API at 'runtime.newapi'...");
	await api.addApi("runtime.newapi", path.join(__dirname, "../api_tests/api_test_mixed"));

	console.log("\n[TEST] Extended API structure:");
	console.log("  - api.runtime:", typeof api.runtime);
	console.log("  - api.runtime.newapi:", typeof api.runtime.newapi);
	console.log("  - api.runtime.newapi keys:", api.runtime.newapi ? Object.keys(api.runtime.newapi) : "N/A");

	// Test that the new API works
	if (api.runtime?.newapi) {
		console.log("\n[TEST] Testing new API endpoints:");
		if (api.runtime.newapi.mathEsm) {
			const result = api.runtime.newapi.mathEsm.add(5, 3);
			console.log(`  - api.runtime.newapi.mathEsm.add(5, 3) = ${result}`);
			if (result !== 8) {
				throw new Error(`Expected 8, got ${result}`);
			}
		} else {
			throw new Error("Failed to call api.runtime.newapi.mathEsm");
		}
	} else {
		throw new Error("Failed to add API at runtime.newapi");
	}

	// Test adding to root level
	console.log("\n[TEST] Adding new API at root level 'utilities'...");
	await api.addApi("utilities", path.join(__dirname, "../api_tests/api_test_cjs"));

	console.log("\n[TEST] Root level API structure:");
	console.log("  - api.utilities:", typeof api.utilities);
	console.log("  - api.utilities keys:", api.utilities ? Object.keys(api.utilities) : "N/A");

	await api.shutdown();
	console.log("\n✅ EAGER mode test passed");
}

/**
 * Test addApi with lazy mode
 * @async
 * @returns {Promise<void>}
 */
async function test_addApi_lazy() {
	console.log("\n🔍 Testing addApi with LAZY mode");

	// Create initial API with lazy mode
	const api = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: true,
		debug: true
	});

	console.log("\n[TEST] Initial API structure:");
	console.log("  - api.math:", typeof api.math);

	// Add new API at services.external path
	console.log("\n[TEST] Adding new API at 'services.external'...");
	await api.addApi("services.external", path.join(__dirname, "../api_tests/api_test_mixed"));

	console.log("\n[TEST] Extended API structure:");
	console.log("  - api.services:", typeof api.services);
	console.log("  - api.services.external:", typeof api.services.external);

	// Test that the new API works (lazy loading will materialize on access)
	if (api.services?.external) {
		console.log("\n[TEST] Testing new API endpoints (lazy materialization):");
		if (api.services.external.mathEsm) {
			// Access triggers lazy loading
			const result = api.services.external.mathEsm.add(10, 20);
			console.log(`  - api.services.external.mathEsm.add(10, 20) = ${result}`);
			if (result !== 30) {
				throw new Error(`Expected 30, got ${result}`);
			}
		} else {
			throw new Error("Failed to call api.services.external.mathEsm");
		}
	} else {
		throw new Error("Failed to add API at services.external");
	}

	await api.shutdown();
	console.log("\n✅ LAZY mode test passed");
}

/**
 * Test addApi with nested paths
 * @async
 * @returns {Promise<void>}
 */
async function test_addApi_nested() {
	console.log("\n🔍 Testing addApi with deeply nested paths");

	const api = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: false,
		debug: false
	});

	// Add API at deeply nested path
	console.log("\n[TEST] Adding API at 'level1.level2.level3'...");
	await api.addApi("level1.level2.level3", path.join(__dirname, "../api_tests/api_test_cjs"));

	console.log("\n[TEST] Nested structure:");
	console.log("  - api.level1:", typeof api.level1);
	console.log("  - api.level1.level2:", typeof api.level1.level2);
	console.log("  - api.level1.level2.level3:", typeof api.level1.level2.level3);
	console.log("  - api.level1.level2.level3 keys:", api.level1?.level2?.level3 ? Object.keys(api.level1.level2.level3) : "N/A");

	if (!api.level1?.level2?.level3) {
		throw new Error("Failed to create nested path structure");
	}

	await api.shutdown();
	console.log("\n✅ Nested path test passed");
}

/**
 * Test error handling
 * @async
 * @returns {Promise<void>}
 */
async function test_addApi_errors() {
	console.log("\n🔍 Testing addApi error handling");

	const api = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: false,
		debug: false
	});

	// Test with non-existent folder
	try {
		await api.addApi("test", "/non/existent/path");
		throw new Error("Should have thrown error for non-existent path");
	} catch (error) {
		if (error.message.includes("Cannot access folder")) {
			console.log("  ✓ Correctly throws error for non-existent folder");
		} else {
			throw error;
		}
	}

	await api.shutdown();
	console.log("\n✅ Error handling test passed");
}

/**
 * Run all tests
 * @async
 * @returns {Promise<void>}
 */
async function runAllTests() {
	console.log("========================================");
	console.log("🧪 Testing addApi Functionality");
	console.log("========================================");

	try {
		await test_addApi_eager();
		await test_addApi_lazy();
		await test_addApi_nested();
		await test_addApi_errors();

		console.log("\n========================================");
		console.log("🎉 All addApi tests passed!");
		console.log("========================================\n");
		process.exit(0);
	} catch (error) {
		console.error("\n========================================");
		console.error("❌ Test failed:", error.message);
		console.error("========================================\n");
		console.error(error.stack);
		process.exit(1);
	}
}

runAllTests();
