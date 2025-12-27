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

	// Test with non-string apiPath
	try {
		await api.addApi(null, path.join(__dirname, "../api_tests/api_test_mixed"));
		throw new Error("Should have thrown error for non-string apiPath");
	} catch (error) {
		if (error.message.includes("apiPath' must be a string")) {
			console.log("  ✓ Correctly throws error for non-string apiPath");
		} else {
			throw error;
		}
	}

	// Test with empty apiPath
	try {
		await api.addApi("", path.join(__dirname, "../api_tests/api_test_mixed"));
		throw new Error("Should have thrown error for empty apiPath");
	} catch (error) {
		if (error.message.includes("non-empty, non-whitespace string") || error.message.includes("non-empty string")) {
			console.log("  ✓ Correctly throws error for empty apiPath");
		} else {
			throw error;
		}
	}

	// Test with apiPath containing empty segments (consecutive dots)
	try {
		await api.addApi("path..test", path.join(__dirname, "../api_tests/api_test_mixed"));
		throw new Error("Should have thrown error for consecutive dots");
	} catch (error) {
		if (error.message.includes("empty segments")) {
			console.log("  ✓ Correctly throws error for consecutive dots");
		} else {
			throw error;
		}
	}

	// Test with leading dot
	try {
		await api.addApi(".test", path.join(__dirname, "../api_tests/api_test_mixed"));
		throw new Error("Should have thrown error for leading dot");
	} catch (error) {
		if (error.message.includes("empty segments")) {
			console.log("  ✓ Correctly throws error for leading dot");
		} else {
			throw error;
		}
	}

	// Test with trailing dot
	try {
		await api.addApi("test.", path.join(__dirname, "../api_tests/api_test_mixed"));
		throw new Error("Should have thrown error for trailing dot");
	} catch (error) {
		if (error.message.includes("empty segments")) {
			console.log("  ✓ Correctly throws error for trailing dot");
		} else {
			throw error;
		}
	}

	// Test with whitespace-only apiPath
	try {
		await api.addApi("   ", path.join(__dirname, "../api_tests/api_test_mixed"));
		throw new Error("Should have thrown error for whitespace-only apiPath");
	} catch (error) {
		if (error.message.includes("non-empty, non-whitespace string") || error.message.includes("non-empty string")) {
			console.log("  ✓ Correctly throws error for whitespace-only apiPath");
		} else {
			throw error;
		}
	}

	// Test with non-string folderPath
	try {
		await api.addApi("test", null);
		throw new Error("Should have thrown error for non-string folderPath");
	} catch (error) {
		if (error.message.includes("folderPath' must be a string")) {
			console.log("  ✓ Correctly throws error for non-string folderPath");
		} else {
			throw error;
		}
	}

	await api.shutdown();
	console.log("\n✅ Error handling test passed");
}

/**
 * Test merging into existing target object
 * @async
 * @returns {Promise<void>}
 */
async function test_addApi_merge() {
	console.log("\n🔍 Testing addApi merging into existing object");

	const api = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: false,
		debug: false
	});

	// First, add something to services.external
	await api.addApi("services.external", path.join(__dirname, "../api_tests/api_test_mixed"));
	const firstResult = api.services.external.mathEsm.add(5, 5);
	console.log(`  🔍 First addition result: ${firstResult}`);

	if (firstResult !== 10) {
		throw new Error(`Expected 10, got ${firstResult}`);
	}
	console.log("  ✓ First API addition successful");

	// Now add more to the same location
	await api.addApi("services.external.more", path.join(__dirname, "../api_tests/api_test"));

	// Verify original still works
	const secondResult = api.services.external.mathEsm.add(3, 7);
	console.log(`  🔍 After second addition: ${secondResult}`);
	if (secondResult !== 10) {
		throw new Error(`Expected 10, got ${secondResult}`);
	}

	// Verify new addition exists
	if (!api.services.external.more) {
		throw new Error("New addition not found at services.external.more");
	}
	console.log("  ✓ Successfully merged into existing object");

	await api.shutdown();
	console.log("\n✅ Merge test passed");
}

/**
 * Test adding properties to functions (slothlet supports function.property pattern)
 * @async
 * @returns {Promise<void>}
 */
async function test_addApi_function_extension() {
	console.log("\n🔍 Testing adding properties to functions");

	const api = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: false,
		debug: false
	});

	// First add a location
	await api.addApi("test.func", path.join(__dirname, "../api_tests/api_test_mixed"));

	// Create a function at a specific path
	api.test.myFunction = () => "I'm a function";

	// Add properties to the function - this SHOULD work in slothlet
	await api.addApi("test.myFunction.nested", path.join(__dirname, "../api_tests/api_test"));

	// Verify the function still works
	const funcResult = api.test.myFunction();
	if (funcResult !== "I'm a function") {
		throw new Error("Function was broken during extension");
	}
	console.log("  ✓ Function still callable after adding properties");

	// Verify the nested properties exist
	if (!api.test.myFunction.nested) {
		throw new Error("Nested properties not added to function");
	}
	console.log("  ✓ Successfully added properties to function");

	// Test with primitive (should fail)
	api.test.primitive = 42;
	try {
		await api.addApi("test.primitive.nested", path.join(__dirname, "../api_tests/api_test"));
		throw new Error("Should have thrown error when trying to extend primitive");
	} catch (error) {
		if (error.message.includes("cannot add properties")) {
			console.log("  ✓ Correctly prevents extension of primitives");
		} else {
			throw error;
		}
	}

	await api.shutdown();
	console.log("\n✅ Function extension test passed");
}

/**
 * Test allowApiOverwrite configuration option
 * @async
 * @returns {Promise<void>}
 */
async function test_addApi_allowOverwrite() {
	console.log("\n🔍 Testing allowApiOverwrite configuration option");

	// Test 1: Default behavior (allowApiOverwrite: true) - should allow overwrites
	console.log("\n[TEST] Testing default behavior (allowApiOverwrite: true)...");
	const api1 = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: false,
		debug: false,
		allowApiOverwrite: true
	});

	// Add initial API
	await api1.addApi("test.endpoint", path.join(__dirname, "../api_tests/api_test_mixed"));
	const initialKeys = Object.keys(api1.test.endpoint);
	console.log(`  🔍 Initial keys at test.endpoint: ${initialKeys.join(", ")}`);

	// Overwrite with different modules - should succeed
	await api1.addApi("test.endpoint", path.join(__dirname, "../api_tests/api_test_cjs"));
	const overwrittenKeys = Object.keys(api1.test.endpoint);
	console.log(`  🔍 After overwrite: ${overwrittenKeys.join(", ")}`);

	// Verify the overwrite happened (keys should be different)
	const hasNewKeys = overwrittenKeys.some((key) => !initialKeys.includes(key));
	if (!hasNewKeys) {
		throw new Error("Overwrite did not occur with allowApiOverwrite: true");
	}
	console.log("  ✓ Successfully overwrote API endpoint with allowApiOverwrite: true");

	await api1.shutdown();

	// Test 2: Prevent overwrites (allowApiOverwrite: false)
	console.log("\n[TEST] Testing overwrite prevention (allowApiOverwrite: false)...");
	const api2 = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: false,
		debug: false,
		allowApiOverwrite: false
	});

	// Add initial API
	await api2.addApi("protected.endpoint", path.join(__dirname, "../api_tests/api_test_mixed"));
	const protectedKeys = Object.keys(api2.protected.endpoint);
	console.log(`  🔍 Initial keys at protected.endpoint: ${protectedKeys.join(", ")}`);

	// Capture console.warn output to verify warning message
	const originalWarn = console.warn;
	let warnMessage = "";
	console.warn = (msg) => {
		warnMessage = msg;
	};

	// Attempt to overwrite - should fail silently with warning
	await api2.addApi("protected.endpoint", path.join(__dirname, "../api_tests/api_test_cjs"));

	// Restore console.warn
	console.warn = originalWarn;

	// Verify warning was logged
	if (!warnMessage.includes("already exists")) {
		throw new Error("Expected warning message about existing endpoint not logged");
	}
	console.log("  ✓ Warning logged when attempting to overwrite with allowApiOverwrite: false");

	// Verify the original API was NOT overwritten
	const unchangedKeys2 = Object.keys(api2.protected.endpoint);
	const keysMatch2 = protectedKeys.length === unchangedKeys2.length && protectedKeys.every((key) => unchangedKeys2.includes(key));

	if (!keysMatch2) {
		throw new Error("API was overwritten despite allowApiOverwrite: false");
	}
	console.log("  ✓ Successfully prevented overwrite with allowApiOverwrite: false");

	await api2.shutdown();

	// Test 3: Test function overwrite prevention
	console.log("\n[TEST] Testing function overwrite with allowApiOverwrite: false...");
	const api3 = await slothlet({
		dir: path.join(__dirname, "../api_tests/api_test"),
		lazy: false,
		debug: false,
		allowApiOverwrite: false
	});

	// First add API modules to create actual API structure
	await api3.addApi("funcTest", path.join(__dirname, "../api_tests/api_test_mixed"));
	const originalKeys = Object.keys(api3.funcTest);
	console.log(`  🔍 Initial keys at funcTest: ${originalKeys.join(", ")}`);

	// Capture console.warn
	let funcWarnMessage = "";
	console.warn = (msg) => {
		funcWarnMessage = msg;
	};

	// Try to overwrite with different modules - should warn and skip
	await api3.addApi("funcTest", path.join(__dirname, "../api_tests/api_test_cjs"));

	console.warn = originalWarn;

	// Verify warning
	if (!funcWarnMessage.includes("already exists")) {
		throw new Error("Expected warning for object overwrite not logged");
	}

	// Verify original modules still intact
	const unchangedKeys3 = Object.keys(api3.funcTest);
	const keysMatch3 = originalKeys.length === unchangedKeys3.length && originalKeys.every((key) => unchangedKeys3.includes(key));

	if (!keysMatch3) {
		throw new Error("API was modified despite allowApiOverwrite: false");
	}
	console.log("  ✓ Successfully prevented object overwrite with allowApiOverwrite: false");

	await api3.shutdown();

	console.log("\n✅ allowApiOverwrite configuration test passed");
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
		await test_addApi_merge();
		await test_addApi_function_extension();
		await test_addApi_allowOverwrite();

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
