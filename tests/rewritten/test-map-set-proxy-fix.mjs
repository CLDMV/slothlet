/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-map-set-proxy-fix.mjs
 *	@Date: 2025-11-14 16:30:00 -08:00 (1762302600)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-11-14 16:30:00 -08:00 (1762302600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test to verify Map and Set objects work correctly with slothlet proxies.
 * @module @cldmv/slothlet/tests/test-map-set-proxy-fix
 */

import slothlet from "@cldmv/slothlet";

console.log("🧪 Map/Set Proxy Fix Test");
console.log("=".repeat(60));

let passCount = 0;
let failCount = 0;

/**
 * Record a test result and update counters
 * @param {string} testName - Name of the test
 * @param {boolean} passed - Whether the test passed
 * @param {string} message - Optional message to display
 */
function recordTest(testName, passed, message = "") {
	if (passed) {
		passCount++;
		console.log(`✅ PASS: ${testName}${message ? ` - ${message}` : ""}`);
	} else {
		failCount++;
		console.log(`❌ FAIL: ${testName}${message ? ` - ${message}` : ""}`);
	}
}

/**
 * Test Map and Set functionality in a given mode
 * @param {string} mode - The slothlet mode ("lazy" or "eager")
 * @param {object} api - The slothlet API instance
 * @returns {object} Test results
 */
async function testMapSetFunctionality(mode, api) {
	console.log(`\n📱 Testing ${mode.toUpperCase()} mode:`);
	console.log("-".repeat(40));

	const results = {
		mode,
		mapTests: {},
		setTests: {},
		errors: []
	};

	// Test Map functionality
	try {
		console.log("  🗺️  Testing Map operations:");

		// Basic Map properties and methods
		const mapSize = api.collections.testMap.size;
		recordTest(`${mode} Map.size property`, typeof mapSize === "number", `size = ${mapSize}`);
		results.mapTests.size = { success: typeof mapSize === "number", value: mapSize };

		// Map.keys() iterator
		try {
			const keys = Array.from(api.collections.testMap.keys());
			recordTest(`${mode} Map.keys() method`, Array.isArray(keys), `keys = [${keys.join(", ")}]`);
			results.mapTests.keys = { success: true, value: keys };
		} catch (error) {
			recordTest(`${mode} Map.keys() method`, false, `error: ${error.message}`);
			results.mapTests.keys = { success: false, error: error.message };
			results.errors.push(`Map.keys(): ${error.message}`);
		}

		// Map.values() iterator
		try {
			const values = Array.from(api.collections.testMap.values());
			recordTest(`${mode} Map.values() method`, Array.isArray(values), `values = [${values.join(", ")}]`);
			results.mapTests.values = { success: true, value: values };
		} catch (error) {
			recordTest(`${mode} Map.values() method`, false, `error: ${error.message}`);
			results.mapTests.values = { success: false, error: error.message };
			results.errors.push(`Map.values(): ${error.message}`);
		}

		// Map.entries() iterator
		try {
			const entries = Array.from(api.collections.testMap.entries());
			recordTest(`${mode} Map.entries() method`, Array.isArray(entries), `entries count = ${entries.length}`);
			results.mapTests.entries = { success: true, value: entries };
		} catch (error) {
			recordTest(`${mode} Map.entries() method`, false, `error: ${error.message}`);
			results.mapTests.entries = { success: false, error: error.message };
			results.errors.push(`Map.entries(): ${error.message}`);
		}

		// Map.get() method
		try {
			const value = api.collections.testMap.get("key1");
			recordTest(`${mode} Map.get() method`, value === "value1", `get("key1") = "${value}"`);
			results.mapTests.get = { success: value === "value1", value };
		} catch (error) {
			recordTest(`${mode} Map.get() method`, false, `error: ${error.message}`);
			results.mapTests.get = { success: false, error: error.message };
			results.errors.push(`Map.get(): ${error.message}`);
		}

		// Map.has() method
		try {
			const hasKey = api.collections.testMap.has("key1");
			recordTest(`${mode} Map.has() method`, hasKey === true, `has("key1") = ${hasKey}`);
			results.mapTests.has = { success: hasKey === true, value: hasKey };
		} catch (error) {
			recordTest(`${mode} Map.has() method`, false, `error: ${error.message}`);
			results.mapTests.has = { success: false, error: error.message };
			results.errors.push(`Map.has(): ${error.message}`);
		}

		// Map.forEach() method
		try {
			let forEachCount = 0;
			api.collections.testMap.forEach(() => forEachCount++);
			recordTest(`${mode} Map.forEach() method`, forEachCount > 0, `forEach count = ${forEachCount}`);
			results.mapTests.forEach = { success: forEachCount > 0, value: forEachCount };
		} catch (error) {
			recordTest(`${mode} Map.forEach() method`, false, `error: ${error.message}`);
			results.mapTests.forEach = { success: false, error: error.message };
			results.errors.push(`Map.forEach(): ${error.message}`);
		}
	} catch (error) {
		console.log(`  💥 General Map error: ${error.message}`);
		results.errors.push(`General Map error: ${error.message}`);
	}

	// Test Set functionality
	try {
		console.log("  🔢 Testing Set operations:");

		// Basic Set properties and methods
		const setSize = api.collections.testSet.size;
		recordTest(`${mode} Set.size property`, typeof setSize === "number", `size = ${setSize}`);
		results.setTests.size = { success: typeof setSize === "number", value: setSize };

		// Set.values() iterator
		try {
			const values = Array.from(api.collections.testSet.values());
			recordTest(`${mode} Set.values() method`, Array.isArray(values), `values = [${values.join(", ")}]`);
			results.setTests.values = { success: true, value: values };
		} catch (error) {
			recordTest(`${mode} Set.values() method`, false, `error: ${error.message}`);
			results.setTests.values = { success: false, error: error.message };
			results.errors.push(`Set.values(): ${error.message}`);
		}

		// Set.keys() iterator (same as values for Set)
		try {
			const keys = Array.from(api.collections.testSet.keys());
			recordTest(`${mode} Set.keys() method`, Array.isArray(keys), `keys = [${keys.join(", ")}]`);
			results.setTests.keys = { success: true, value: keys };
		} catch (error) {
			recordTest(`${mode} Set.keys() method`, false, `error: ${error.message}`);
			results.setTests.keys = { success: false, error: error.message };
			results.errors.push(`Set.keys(): ${error.message}`);
		}

		// Set.entries() iterator
		try {
			const entries = Array.from(api.collections.testSet.entries());
			recordTest(`${mode} Set.entries() method`, Array.isArray(entries), `entries count = ${entries.length}`);
			results.setTests.entries = { success: true, value: entries };
		} catch (error) {
			recordTest(`${mode} Set.entries() method`, false, `error: ${error.message}`);
			results.setTests.entries = { success: false, error: error.message };
			results.errors.push(`Set.entries(): ${error.message}`);
		}

		// Set.has() method
		try {
			const hasValue = api.collections.testSet.has("item1");
			recordTest(`${mode} Set.has() method`, hasValue === true, `has("item1") = ${hasValue}`);
			results.setTests.has = { success: hasValue === true, value: hasValue };
		} catch (error) {
			recordTest(`${mode} Set.has() method`, false, `error: ${error.message}`);
			results.setTests.has = { success: false, error: error.message };
			results.errors.push(`Set.has(): ${error.message}`);
		}

		// Set.forEach() method
		try {
			let forEachCount = 0;
			api.collections.testSet.forEach(() => forEachCount++);
			recordTest(`${mode} Set.forEach() method`, forEachCount > 0, `forEach count = ${forEachCount}`);
			results.setTests.forEach = { success: forEachCount > 0, value: forEachCount };
		} catch (error) {
			recordTest(`${mode} Set.forEach() method`, false, `error: ${error.message}`);
			results.setTests.forEach = { success: false, error: error.message };
			results.errors.push(`Set.forEach(): ${error.message}`);
		}
	} catch (error) {
		console.log(`  💥 General Set error: ${error.message}`);
		results.errors.push(`General Set error: ${error.message}`);
	}

	return results;
}

/**
 * Main test execution
 */
async function runMapSetTests() {
	console.log("📚 Loading test API with Map and Set collections...");

	// Load both lazy and eager APIs for comparison
	const lazyAPI = await slothlet({
		dir: "./api_tests/api_test_collections",
		mode: "lazy"
	});

	const eagerAPI = await slothlet({
		dir: "./api_tests/api_test_collections",
		mode: "eager"
	});

	console.log("✅ APIs loaded successfully");

	// Test both modes
	const lazyResults = await testMapSetFunctionality("lazy", lazyAPI);
	const eagerResults = await testMapSetFunctionality("eager", eagerAPI);

	// Compare results between modes
	console.log("\n🔍 Mode Comparison:");
	console.log("=".repeat(40));

	const mapTestNames = Object.keys(lazyResults.mapTests);
	const setTestNames = Object.keys(lazyResults.setTests);

	for (const testName of mapTestNames) {
		const lazyTest = lazyResults.mapTests[testName];
		const eagerTest = eagerResults.mapTests[testName];
		const match = lazyTest.success === eagerTest.success;

		console.log(
			`📊 Map.${testName}: Lazy ${lazyTest.success ? "✅" : "❌"}, Eager ${eagerTest.success ? "✅" : "❌"}, Match: ${match ? "✅" : "❌"}`
		);

		if (!match) {
			recordTest(`Mode consistency for Map.${testName}`, false, "Results differ between modes");
		}
	}

	for (const testName of setTestNames) {
		const lazyTest = lazyResults.setTests[testName];
		const eagerTest = eagerResults.setTests[testName];
		const match = lazyTest.success === eagerTest.success;

		console.log(
			`📊 Set.${testName}: Lazy ${lazyTest.success ? "✅" : "❌"}, Eager ${eagerTest.success ? "✅" : "❌"}, Match: ${match ? "✅" : "❌"}`
		);

		if (!match) {
			recordTest(`Mode consistency for Set.${testName}`, false, "Results differ between modes");
		}
	}

	// Summary
	console.log("\n📋 Test Summary:");
	console.log("=".repeat(40));
	console.log(`✅ Passed: ${passCount}`);
	console.log(`❌ Failed: ${failCount}`);
	console.log(`📊 Total:  ${passCount + failCount}`);

	// Show all errors
	const allErrors = [...lazyResults.errors, ...eagerResults.errors];
	if (allErrors.length > 0) {
		console.log("\n🐛 Error Summary:");
		allErrors.forEach((error, index) => {
			console.log(`  ${index + 1}. ${error}`);
		});
	}

	if (failCount === 0 && passCount > 0) {
		console.log("\n🎉 All tests passed! Map/Set proxy fix is working correctly.");
		return true;
	} else {
		console.log("\n💥 Some tests failed. Map/Set proxy fix needs work.");
		return false;
	}
}

// Run the tests
runMapSetTests()
	.then((success) => {
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error("💥 Test execution failed:", error);
		process.exit(1);
	});
