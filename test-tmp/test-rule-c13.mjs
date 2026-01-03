/**
 * @fileoverview Test file for Rule C13 - Testing addApi functionality with config folder
 * @module test-tmp/test-rule-c13
 */

import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test Rule C13: Demonstrating addApi flattening bug
 * addApi should flatten modules the same way as initial loading, but currently creates nested structure
 * @async
 * @returns {Promise<void>}
 */
export async function testRuleC13() {
	// Import slothlet
	const slothlet = (await import("@cldmv/slothlet")).default;

	console.log("=== Testing addApi flattening behavior ===\n");

	// Test 1: Load our test-tmp/api/config directly to see expected flattening
	console.log("1. Loading test-tmp/api directly (expected behavior):");
	const apiDirect = await slothlet({
		dir: path.join(__dirname, "api"),
		debug: false
	});

	console.log("Direct load api.config:", apiDirect.config);
	console.log("Direct load - api.config.getConfig exists:", typeof apiDirect.config.getConfig === "function");
	console.log("Direct load - api.config.value:", apiDirect.config.value);

	// Test 2: Load api_tests/api_test first, then addApi our nested config (shows the bug)
	console.log("\n2. Loading api_tests/api_test first, then addApi nested config (buggy behavior):");
	const api = await slothlet({
		dir: "../api_tests/api_test",
		debug: false
	});

	console.log("Before addApi - api.config:", api.config);

	// Use addApi to add the nested config folder - this should replace, not merge
	await api.addApi("config", path.join(__dirname, "api"));

	console.log("After addApi nested - api.config:", api.config);
	console.log("After addApi nested - api.config.getConfig exists:", typeof api.config.getConfig === "function");
	console.log("After addApi nested - api.config.config exists (bug!):", typeof api.config.config === "object");

	// Test 3: Test with root-level config.mjs to see if issue persists
	console.log("\n3. Testing root-level config.mjs with addApi:");
	const api2 = await slothlet({
		dir: "../api_tests/api_test",
		debug: false
	});

	console.log("Before addApi root-level - api2.config:", api2.config);

	// Add root-level config.mjs
	await api2.addApi("config", path.join(__dirname, "api-root-test"));

	console.log("After addApi root-level - api2.config:", api2.config);
	console.log("After addApi root-level - api2.config.getConfig exists:", typeof api2.config.getConfig === "function");
	console.log("After addApi root-level - api2.config.config exists:", typeof api2.config.config === "object");

	// Test 4: Direct load of root-level config for comparison
	console.log("\n4. Loading api-root-test directly (expected behavior):");
	const apiRootDirect = await slothlet({
		dir: path.join(__dirname, "api-root-test"),
		debug: false
	});

	console.log("Direct root load api.config:", apiRootDirect.config);
	console.log("Direct root load - api.config.getConfig exists:", typeof apiRootDirect.config.getConfig === "function");
	console.log("Direct root load - api.config.value:", apiRootDirect.config.value);

	console.log("\n=== Bug Analysis ===");
	console.log("Expected: api.config.getConfig should be a function (like direct load)");
	console.log("Actual: api.config.config.getConfig is the function (nested incorrectly)");
	console.log("Problem: addApi merges instead of replacing/flattening properly");

	// Show what works vs what doesn't
	const directWorks = typeof apiDirect.config.getConfig === "function";
	const addApiWorks = typeof api.config.getConfig === "function";
	const addApiNested = typeof api.config.config?.getConfig === "function";
	const rootAddApiWorks = typeof api2.config.getConfig === "function";
	const rootDirectWorks = typeof apiRootDirect.config.getConfig === "function";

	console.log("\n=== Test Results ===");
	console.log(`Direct nested load works: ${directWorks} ✓`);
	console.log(`addApi nested works (expected): ${addApiWorks} ${addApiWorks ? "✓" : "✗"}`);
	console.log(`addApi nested creates bug: ${addApiNested} ${addApiNested ? "(shows bug exists)" : ""}`);
	console.log(`addApi root-level works (expected): ${rootAddApiWorks} ${rootAddApiWorks ? "✓" : "✗"}`);
	console.log(`Direct root-level works: ${rootDirectWorks} ✓`);

	if ((!addApiWorks && addApiNested) || !rootAddApiWorks) {
		console.log("\n🐛 BUG CONFIRMED: addApi creates nested/merged structure instead of flattening properly");

		if (!addApiWorks && addApiNested) {
			console.log("  - Nested config issue: config/config.mjs should flatten to api.config, not api.config.config");
		}
		if (!rootAddApiWorks) {
			console.log("  - Root-level config issue: config.mjs should flatten properly when added via addApi");
		}
	}

	// Shutdown
	await api.shutdown();
	await api2.shutdown();
	await apiDirect.shutdown();
	await apiRootDirect.shutdown();
}

// Run the test
testRuleC13().catch(console.error);
