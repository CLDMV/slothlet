/**
 * Test hot reload functionality using matrix testing
 * Tests the .reload() method with addApi/removeApi tracking across all configurations
 */

import slothlet from "@cldmv/slothlet";
import { runTestMatrix } from "./test-helper.mjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let totalTests = 0;
let failedTests = 0;

console.log("\n=== Hot Reload Test Suite ===\n");

// Test 1: Basic reload across all configurations
totalTests++;
let result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName, fullConfig) => {
		// Check based on directory structure
		const isMixed = fullConfig.dir.includes("api_test_mixed");
		const checkFunc = isMixed ? api.mathEsm?.add : api.math?.add;

		// Initial load check
		if (typeof checkFunc !== "function") {
			throw new Error(`[${configName}] Math add function not available after initial load`);
		}

		const result1 = await checkFunc(2, 3);
		if (result1 !== 5) {
			throw new Error(`[${configName}] Expected 5, got ${result1}`);
		}

		// Store original instanceId
		const originalInstanceId = api.instanceId;

		// Reload
		await api.reload();

		// instanceId should be regenerated on reload
		if (api.instanceId === originalInstanceId) {
			throw new Error(`[${configName}] instanceId should be regenerated on reload`);
		}

		// Check after reload
		const checkFunc2 = isMixed ? api.mathEsm?.add : api.math?.add;
		if (typeof checkFunc2 !== "function") {
			throw new Error(`[${configName}] Math add function not available after reload`);
		}

		const result2 = await checkFunc2(4, 5);
		if (result2 !== 9) {
			throw new Error(`[${configName}] Expected 9, got ${result2}`);
		}
	},
	"Test 1: Basic reload"
);
if (result.failed > 0) failedTests++;

// Test 2: Reload with addApi (with moduleId)
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName, fullConfig) => {
		const isMixed = fullConfig.dir.includes("api_test_mixed");

		// Add extra API with moduleId
		await api.addApi("extra", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "extra-module" });

		if (typeof api.extra?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra.mathCjs not available after addApi`);
		}

		// Reload - should preserve the addApi
		await api.reload();

		const checkFunc = isMixed ? api.mathEsm?.add : api.math?.add;
		if (typeof checkFunc !== "function") {
			throw new Error(`[${configName}] Math add function not available after reload`);
		}

		if (typeof api.extra?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra.mathCjs not preserved after reload`);
		}
	},
	"Test 2: Reload with addApi (with moduleId)"
);
if (result.failed > 0) failedTests++;

// Test 3: Reload with addApi (without moduleId)
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName, fullConfig) => {
		const isMixed = fullConfig.dir.includes("api_test_mixed");

		// Add extra API without moduleId
		await api.addApi("extra", join(__dirname, "../api_tests/api_test_mixed"));

		if (typeof api.extra?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra.mathCjs not available after addApi`);
		}

		// Reload - should preserve the addApi even without moduleId
		await api.reload();

		const checkFunc = isMixed ? api.mathEsm?.add : api.math?.add;
		if (typeof checkFunc !== "function") {
			throw new Error(`[${configName}] Math add function not available after reload`);
		}

		if (typeof api.extra?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra.mathCjs not preserved after reload without moduleId`);
		}
	},
	"Test 3: Reload with addApi (without moduleId)"
);
if (result.failed > 0) failedTests++;

// Test 4: Reload with removeApi
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName, fullConfig) => {
		const isMixed = fullConfig.dir.includes("api_test_mixed");

		// Add extra API with moduleId
		await api.addApi("extra", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "test-module" });

		if (typeof api.extra?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra.mathCjs not available after addApi`);
		}

		// Remove it
		await api.removeApi({ moduleId: "test-module" });

		if ("extra" in api) {
			throw new Error(`[${configName}] api.extra still exists after removeApi`);
		}

		// Reload - should NOT restore removed API
		await api.reload();

		const checkFunc = isMixed ? api.mathEsm?.add : api.math?.add;
		if (typeof checkFunc !== "function") {
			throw new Error(`[${configName}] Math add function not available after reload`);
		}

		if ("extra" in api) {
			throw new Error(`[${configName}] api.extra incorrectly restored after reload`);
		}
	},
	"Test 4: Reload with removeApi"
);
if (result.failed > 0) failedTests++;

// Test 5: Reference preservation
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName) => {
		// Store reference
		const originalReference = api;

		// Reload
		await api.reload();

		// Check references are same
		if (api !== originalReference) {
			throw new Error(`[${configName}] API reference was not preserved`);
		}
	},
	"Test 5: Reference preservation"
);
if (result.failed > 0) failedTests++;

// Test 6: reload() not available when hotReload disabled
totalTests++;
console.log("\n📋 Test 6: reload() not available when hotReload disabled");
try {
	const api = await slothlet({
		dir: join(__dirname, "../api_tests/api_test"),
		hotReload: false
	});

	if (typeof api.reload === "function") {
		throw new Error("reload() should not be available when hotReload is disabled");
	}

	console.log("   ✅ PASSED: reload() correctly not exposed");
	await api.shutdown();
} catch (error) {
	console.log("   ❌ FAILED:", error.message);
	process.exit(1);
}

// Test 7: Multiple addApi to same path with different moduleIds
await runTestMatrix(
	{ hotReload: true },
	async (api, configName, fullConfig) => {
		// Add API with first moduleId
		await api.addApi("extra1", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "module-1" });

		if (typeof api.extra1?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra1.mathCjs not available`);
		}

		// Add API with second moduleId to different path
		await api.addApi("extra2", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "module-2" });

		if (typeof api.extra2?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra2.mathCjs not available`);
		}

		// Reload - both should be preserved
		await api.reload();

		if (typeof api.extra1?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra1.mathCjs not preserved after reload`);
		}

		if (typeof api.extra2?.mathCjs !== "object") {
			throw new Error(`[${configName}] api.extra2.mathCjs not preserved after reload`);
		}
	},
	"Test 7: Multiple addApi with different moduleIds"
);
if (result.failed > 0) failedTests++;

// Test 8: Reload after addApi overwrite
totalTests++;
result = await runTestMatrix(
	{ hotReload: true, allowApiOverwrite: true },
	async (api, configName) => {
		// Add API with moduleId
		await api.addApi("extra", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "module-x" });

		// Overwrite with same moduleId (should update tracking)
		await api.addApi("extra", join(__dirname, "../api_tests/api_test"), {}, { moduleId: "module-x" });

		// Reload - should use the last addApi call
		await api.reload();

		// After reload, should have the api_test content, not api_test_mixed
		if (typeof api.extra?.math?.add !== "function") {
			throw new Error(`[${configName}] api.extra.math.add not available after reload (should have api_test content)`);
		}
	},
	"Test 8: Reload after addApi overwrite"
);
if (result.failed > 0) failedTests++;

// Test 9: Reload after shutdown
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName, fullConfig) => {
		const isMixed = fullConfig.dir.includes("api_test_mixed");
		const checkFunc = isMixed ? api.mathEsm?.add : api.math?.add;

		// Verify initial state
		if (typeof checkFunc !== "function") {
			throw new Error(`[${configName}] Math add function not available initially`);
		}

		// Shutdown
		await api.shutdown();

		// Reload after shutdown - should re-initialize
		await api.reload();

		// Check API is functional again
		const checkFunc2 = isMixed ? api.mathEsm?.add : api.math?.add;
		if (typeof checkFunc2 !== "function") {
			throw new Error(`[${configName}] Math add function not available after reload post-shutdown`);
		}

		const result = await checkFunc2(10, 20);
		if (result !== 30) {
			throw new Error(`[${configName}] Expected 30, got ${result}`);
		}
	},
	"Test 9: Reload after shutdown"
);
if (result.failed > 0) failedTests++;

console.log("\n=== All Hot Reload Tests Complete ===\n");

if (failedTests > 0) {
	console.error(`\n❌ ${failedTests} test(s) failed out of ${totalTests} total\n`);
	process.exit(1);
} else {
	console.log(`\n✅ All ${totalTests} tests passed!\n`);
	process.exit(0);
}
