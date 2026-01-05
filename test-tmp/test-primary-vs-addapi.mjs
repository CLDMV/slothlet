/**
 * Comprehensive comparison test: Primary load vs addApi load
 * Tests each folder structure to understand expected vs actual behavior
 */

import slothlet from "../index.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log("=== Primary Load vs addApi Comparison Test ===\n");

// Test folders to analyze
const testFolders = [
	{
		name: "test-tmp-api", 
		path: path.join(projectRoot, "test-tmp/api"),
		description: "Nested folder with config/config.mjs"
	},
	{
		name: "test-tmp-api2", 
		path: path.join(projectRoot, "test-tmp/api2"),
		description: "Root config.mjs with export default object"
	},
	{
		name: "test-tmp-api3", 
		path: path.join(projectRoot, "test-tmp/api3"),
		description: "Root config.mjs with named exports only"
	}
];

/**
 * Deep structure analysis helper
 */
function analyzeStructure(obj, path = "") {
	const result = {};
	
	for (const [key, value] of Object.entries(obj)) {
		const fullPath = path ? `${path}.${key}` : key;
		
		if (typeof value === "function") {
			result[fullPath] = "function";
		} else if (Array.isArray(value)) {
			result[fullPath] = "array";
		} else if (value && typeof value === "object") {
			result[fullPath] = "object";
			// Recursively analyze nested objects
			Object.assign(result, analyzeStructure(value, fullPath));
		} else {
			result[fullPath] = typeof value;
		}
	}
	
	return result;
}

// Test each folder
for (const testFolder of testFolders) {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`Testing: ${testFolder.name}`);
	console.log(`Description: ${testFolder.description}`);
	console.log(`Path: ${testFolder.path}`);
	console.log(`${"=".repeat(60)}\n`);

	try {
		// 1. Primary load (direct loading of the folder)
		console.log("1. PRIMARY LOAD (Expected behavior):");
		const primaryApi = await slothlet({ 
			dir: testFolder.path,
			debug: false 
		});
		
		const primaryStructure = analyzeStructure(primaryApi);
		console.log("   Structure paths found:");
		for (const [structPath, type] of Object.entries(primaryStructure)) {
			console.log(`     ${structPath}: ${type}`);
		}
		
		console.log("   Raw object preview:");
		console.log("   ", JSON.stringify(primaryApi, null, 2).slice(0, 200) + "...");

		// 2. addApi load (loading into base API then adding)
		console.log("\n2. ADDAPI LOAD (Current behavior):");
		// Use a simple base API without config to avoid interference
		const baseApi = await slothlet({ 
			dir: path.join(projectRoot, "api_tests/api_test_collections"),  // No config here
			debug: false 
		});
		
		await baseApi.addApi("config", testFolder.path);
		
		const addApiStructure = analyzeStructure({ config: baseApi.config });
		console.log("   Structure paths found:");
		for (const [structPath, type] of Object.entries(addApiStructure)) {
			console.log(`     ${structPath}: ${type}`);
		}
		
		console.log("   Raw object preview:");
		console.log("   ", JSON.stringify({ config: baseApi.config }, null, 2).slice(0, 200) + "...");

		// 3. Compare structures
		console.log("\n3. COMPARISON ANALYSIS:");
		
		// Extract just the primary structure (without the 'config' prefix that addApi adds)
		const primaryPaths = Object.keys(primaryStructure);
		const addApiPaths = Object.keys(addApiStructure)
			.map(path => path.replace(/^config\./, ''))
			.filter(path => path !== 'config'); // Remove the root 'config' entry
		
		console.log("   Primary load paths:", primaryPaths);
		console.log("   addApi load paths: ", addApiPaths);
		
		// Check for missing paths
		const missingInAddApi = primaryPaths.filter(path => !addApiPaths.includes(path));
		const extraInAddApi = addApiPaths.filter(path => !primaryPaths.includes(path));
		
		if (missingInAddApi.length > 0) {
			console.log("   ❌ Missing in addApi:", missingInAddApi);
		}
		if (extraInAddApi.length > 0) {
			console.log("   ❌ Extra in addApi:", extraInAddApi);
		}
		if (missingInAddApi.length === 0 && extraInAddApi.length === 0) {
			console.log("   ✅ Structures match perfectly!");
		} else {
			console.log("   ❌ Structures differ - addApi has inconsistent behavior");
		}

	} catch (error) {
		console.error(`❌ Error testing ${testFolder.name}:`, error.message);
	}
}

console.log(`\n${"=".repeat(60)}`);
console.log("Summary: This test shows the expected behavior (primary load) vs actual (addApi)");
console.log("The goal is to make addApi produce identical structures to primary loading");
console.log(`${"=".repeat(60)}`);