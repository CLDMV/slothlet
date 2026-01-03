/**
 * @fileoverview Enhanced test file for addApi flattening behavior
 * Tests both nested folder structure and root-level files with/without export default
 * @module test-tmp/test-addapi-comprehensive
 */

import { fileURLToPath } from "url";
import path from "path";

// const DEBUG = true;
const DEBUG = false;

const ADDAPI_PATH = "config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Comprehensive test for addApi flattening behavior across different scenarios
 * @async
 * @returns {Promise<void>}
 */
export async function testAddApiComprehensive() {
	// Import slothlet
	const slothlet = (await import("@cldmv/slothlet")).default;

	console.log("=== Comprehensive addApi flattening test ===\n");

	// Test 1: Nested folder structure (our original bug)
	console.log("1. Testing nested folder structure (api/config/config.mjs):");
	console.log("   Expected: Direct access to config properties after addApi");
	console.log("   Actual bug: Nested access (config.config.property)");

	const apiNested = await slothlet({
		dir: "../api_tests/api_test_mixed",
		debug: DEBUG
	});

	console.log("   Before addApi - apiNested." + ADDAPI_PATH + " exists:", typeof apiNested[ADDAPI_PATH] === "object");
	await apiNested.addApi(ADDAPI_PATH, path.join(__dirname, "api"));
	console.log("   After addApi - apiNested." + ADDAPI_PATH + ".getConfig exists:", typeof apiNested[ADDAPI_PATH].getConfig === "function");
	console.log("   After addApi - apiNested." + ADDAPI_PATH + ".config exists (bug!):", typeof apiNested[ADDAPI_PATH].config === "object");

	// Test 2: Root-level file with export default
	console.log("\n2. Testing root-level config.mjs WITH export default:");
	console.log("   Expected: Default export should be flattened according to API rules");

	const apiDirect2 = await slothlet({
		dir: path.join(__dirname, "api2"),
		debug: DEBUG
	});
	console.log("   Direct load - apiDirect2." + ADDAPI_PATH + ":", apiDirect2[ADDAPI_PATH]);
	console.log(
		"   Direct load - apiDirect2." + ADDAPI_PATH + ".getConfig exists:",
		typeof apiDirect2[ADDAPI_PATH]?.getConfig === "function"
	);
	console.log("   Direct load - apiDirect2." + ADDAPI_PATH + ".value:", apiDirect2[ADDAPI_PATH]?.value);

	const apiAddApi2 = await slothlet({
		dir: "../api_tests/api_test_mixed",
		debug: DEBUG
	});
	await apiAddApi2.addApi(ADDAPI_PATH, path.join(__dirname, "api2"));
	console.log("   addApi - apiAddApi2." + ADDAPI_PATH + ":", apiAddApi2[ADDAPI_PATH]);
	console.log("   addApi - apiAddApi2." + ADDAPI_PATH + ".getConfig exists:", typeof apiAddApi2[ADDAPI_PATH].getConfig === "function");
	console.log("   addApi - apiAddApi2 nested exists:", typeof apiAddApi2[ADDAPI_PATH].config === "object");

	// Test 3: Root-level file without export default
	console.log("\n3. Testing root-level config.mjs WITHOUT export default (named exports only):");
	console.log("   Expected: Named exports should be handled consistently");

	const apiDirect3 = await slothlet({
		dir: path.join(__dirname, "api3"),
		debug: DEBUG
	});
	console.log("   Direct load - apiDirect3.config:", apiDirect3.config);
	console.log("   Direct load - apiDirect3.config.getConfig exists:", typeof apiDirect3.config.getConfig === "function");
	console.log("   Direct load - apiDirect3.config.configValue:", apiDirect3.config.configValue);

	const apiAddApi3 = await slothlet({
		dir: "../api_tests/api_test_mixed",
		debug: DEBUG
	});
	await apiAddApi3.addApi(ADDAPI_PATH, path.join(__dirname, "api3"));
	console.log("   addApi - apiAddApi3." + ADDAPI_PATH + ":", apiAddApi3[ADDAPI_PATH]);
	console.log("   addApi - apiAddApi3." + ADDAPI_PATH + ".getConfig exists:", typeof apiAddApi3[ADDAPI_PATH].getConfig === "function");
	console.log("   addApi - apiAddApi3 nested exists:", typeof apiAddApi3[ADDAPI_PATH].config === "object");

	console.log("\n=== Analysis ===");
	const nestedBug = typeof apiNested[ADDAPI_PATH].config === "object";
	const defaultBug = typeof apiAddApi2[ADDAPI_PATH].config === "object";
	const namedBug = typeof apiAddApi3[ADDAPI_PATH].config === "object";

	console.log("apiNested: ", apiNested);
	console.log("apiDirect2: ", apiDirect2);
	console.log("apiAddApi2: ", apiAddApi2);
	console.log("apiDirect3: ", apiDirect3);
	console.log("apiAddApi3: ", apiAddApi3);

	console.log(`Nested folder bug: ${nestedBug ? "CONFIRMED" : "NOT FOUND"}`);
	console.log(`Root default export bug: ${defaultBug ? "CONFIRMED" : "NOT FOUND"}`);
	console.log(`Root named export bug: ${namedBug ? "CONFIRMED" : "NOT FOUND"}`);

	if (nestedBug || defaultBug || namedBug) {
		console.log("\n🐛 BUG PATTERN: addApi doesn't apply flattening rules consistently");
		console.log("   This suggests addApi bypasses the normal flattening logic used in initial loading");
	}

	// Cleanup
	await apiNested.shutdown();
	await apiDirect2.shutdown();
	await apiAddApi2.shutdown();
	await apiDirect3.shutdown();
	await apiAddApi3.shutdown();
}

// Run the test
testAddApiComprehensive().catch(console.error);
