/**
 * Concrete verification: Primary load content vs addApi content
 * Tests if api.config from addApi exactly matches the full primary load
 */

import slothlet from "../index.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log("=== Concrete Verification: Primary vs addApi Content ===\n");

// Test folders
const testFolders = [
	{ name: "test-tmp-api", path: path.join(projectRoot, "test-tmp/api") },
	{ name: "test-tmp-api2", path: path.join(projectRoot, "test-tmp/api2") },
	{ name: "test-tmp-api3", path: path.join(projectRoot, "test-tmp/api3") }
];

for (const folder of testFolders) {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`Testing: ${folder.name}`);
	console.log(`Path: ${folder.path}`);
	console.log(`${"=".repeat(60)}`);

	try {
		// 1. Load folder as primary
		console.log("1. PRIMARY LOAD - Full result:");
		const primaryApi = await slothlet({ dir: folder.path, debug: false });
		const primaryResult = JSON.parse(JSON.stringify(primaryApi)); // Deep clone to remove functions
		delete primaryResult.hooks; // Remove slothlet's built-in hooks for comparison
		console.log("   Primary result (without hooks):", JSON.stringify(primaryResult, null, 2));

		// 2. Load via addApi
		console.log("\n2. ADDAPI LOAD - Content at api.config:");
		const baseApi = await slothlet({ dir: path.join(projectRoot, "api_tests/api_test_collections"), debug: false });
		await baseApi.addApi("config", folder.path);
		const addApiResult = JSON.parse(JSON.stringify(baseApi.config)); // Deep clone
		console.log("   addApi result at api.config:", JSON.stringify(addApiResult, null, 2));

		// 3. Compare structures
		console.log("\n3. COMPARISON:");
		const primaryStr = JSON.stringify(primaryResult, null, 2);
		const addApiStr = JSON.stringify(addApiResult, null, 2);
		
		if (primaryStr === addApiStr) {
			console.log("   ✅ EXACT MATCH! addApi content exactly matches primary result");
			console.log("   ✅ This means addApi is working correctly - no flattening bug");
			console.log("   ✅ The 'extra .config' is just because the folder produces a config object");
		} else {
			console.log("   ❌ MISMATCH - addApi is not preserving the same structure");
			console.log("   📊 Differences found - this indicates a real bug");
		}

	} catch (error) {
		console.error(`❌ Error testing ${folder.name}:`, error.message);
	}
}

console.log(`\n${"=".repeat(60)}`);
console.log("Summary:");
console.log("- If all tests show EXACT MATCH: addApi is working correctly");
console.log("- If any show MISMATCH: there's a real flattening bug in addApi");
console.log(`${"=".repeat(60)}`);