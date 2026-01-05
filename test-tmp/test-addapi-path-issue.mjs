/**
 * Simple test to verify the addApi path placement issue
 */

import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import slothlet
const slothlet = (await import("@cldmv/slothlet")).default;

console.log("=== Testing addApi path placement ===\n");

// First, let's see what direct loading produces
console.log("1. Direct loading of api folder:");
const apiDirect = await slothlet({
	dir: path.join(__dirname, "api"),
	debug: true
});

console.log("Direct load result:", JSON.stringify(Object.keys(apiDirect), null, 2));
console.log("Direct load api.config:", JSON.stringify(Object.keys(apiDirect.config || {}), null, 2));

// Now let's see what addApi produces
console.log("\n2. AddApi loading of api folder:");
const apiBase = await slothlet({
	dir: "../api_tests/api_test_mixed",
	debug: false
});

console.log("Before addApi - base keys:", Object.keys(apiBase));

await apiBase.addApi("testPath", path.join(__dirname, "api"));

console.log("After addApi - base keys:", Object.keys(apiBase));
console.log("After addApi - apiBase.testPath:", JSON.stringify(Object.keys(apiBase.testPath || {}), null, 2));
console.log("After addApi - apiBase.testPath.config:", JSON.stringify(Object.keys(apiBase.testPath.config || {}), null, 2));

console.log("\n=== Analysis ===");
console.log("Direct load puts config functions at: apiDirect.config.getConfig");
console.log("AddApi puts config functions at: apiBase.testPath.config.getConfig");
console.log("This shows that addApi is placing the ENTIRE structure at the path, not flattening into the path");

await apiDirect.shutdown();
await apiBase.shutdown();
