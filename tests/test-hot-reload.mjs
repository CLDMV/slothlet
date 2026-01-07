/**
 * Test hot reload functionality using matrix testing
 * Tests the .reload() method with addApi/removeApi tracking across all configurations
 */

// Enable internal test mode for context/reference access
process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

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

// Test 6 removed - was duplicate of Test 15

// Test 7: Multiple addApi to same path with different moduleIds
await runTestMatrix(
	{ hotReload: true },
	async (api, configName, _) => {
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

// Test 10: reloadApi() - selective reload of specific API path
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName) => {
		// Add multiple APIs
		await api.addApi("extra1", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "module-1" });
		await api.addApi("extra2", join(__dirname, "../api_tests/api_test"), {}, { moduleId: "module-2" });

		// Store reference to extra1
		const extra1Ref = api.extra1;

		// Reload only extra1
		await api.reloadApi("extra1");

		// extra1 should be reloaded (same reference due to mutateExisting)
		if (api.extra1 !== extra1Ref) {
			throw new Error(`[${configName}] extra1 reference should be preserved after reloadApi`);
		}

		// extra2 should be untouched
		if (typeof api.extra2?.math?.add !== "function") {
			throw new Error(`[${configName}] extra2 should remain intact after reloadApi("extra1")`);
		}
	},
	"Test 10: reloadApi() - selective reload"
);
if (result.failed > 0) failedTests++;

// Test 11: reloadApi() with multiple modules on same path
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName) => {
		// Add two modules to same path
		await api.addApi("features", join(__dirname, "../api_tests/api_test"), {}, { moduleId: "core" });
		await api.addApi("features", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "extra", forceOverwrite: true });

		// Reload the entire "features" path - should reload both modules
		await api.reloadApi("features");

		// Both should still be available
		if (typeof api.features?.math?.add !== "function") {
			throw new Error(`[${configName}] features.math.add not available after reloadApi`);
		}
	},
	"Test 11: reloadApi() with multiple modules on same path"
);
if (result.failed > 0) failedTests++;

// Test 12: Context preservation across reload
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName) => {
		const testContext = { userId: 123, session: "abc" };
		api.context.userId = testContext.userId;
		api.context.session = testContext.session;

		// Reload
		await api.reload();

		// Context should be preserved
		if (api.context.userId !== 123 || api.context.session !== "abc") {
			throw new Error(`[${configName}] Context not preserved after reload`);
		}
	},
	"Test 12: Context preservation across reload"
);
if (result.failed > 0) failedTests++;

// Test 13: Reference preservation across reload
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName) => {
		api.reference.customUtil = () => "test";
		api.reference.constant = 42;

		// Reload
		await api.reload();

		// Reference should be preserved
		if (typeof api.reference.customUtil !== "function" || api.reference.customUtil() !== "test") {
			throw new Error(`[${configName}] Reference.customUtil not preserved after reload`);
		}
		if (api.reference.constant !== 42) {
			throw new Error(`[${configName}] Reference.constant not preserved after reload`);
		}
	},
	"Test 13: Reference preservation across reload"
);
if (result.failed > 0) failedTests++;

// Test 14: Hooks preservation across reload
totalTests++;
result = await runTestMatrix(
	{ hotReload: true, hooks: true },
	async (api, configName, fullConfig) => {
		const isMixed = fullConfig.dir.includes("api_test_mixed");
		let hookCalled = false;

		// Register a hook
		api.hooks.on(
			"test-hook",
			"before",
			({ path: ___path, args: ___args }) => {
				hookCalled = true;
			},
			{ pattern: "**" }
		);

		// Reload
		await api.reload();

		// Call function to trigger hook
		const checkFunc = isMixed ? api.mathEsm?.add : api.math?.add;
		if (typeof checkFunc === "function") {
			await checkFunc(1, 2);
		}

		// Hook should still work after reload
		if (!hookCalled) {
			throw new Error(`[${configName}] Hook not preserved/executed after reload`);
		}
	},
	"Test 14: Hooks preservation across reload"
);
if (result.failed > 0) failedTests++;

// Test 15: Error - reload() when hotReload disabled
totalTests++;
console.log("\n📋 Test 15: Error - reload() when hotReload disabled");
try {
	const api = await slothlet({
		dir: join(__dirname, "../api_tests/api_test"),
		hotReload: false
	});

	let errorThrown = false;
	try {
		await api.reload();
	} catch (error) {
		if (error.message.includes("hotReload must be enabled")) {
			errorThrown = true;
		}
	}

	if (!errorThrown) {
		throw new Error("reload() should throw error when hotReload is disabled");
	}

	console.log("   ✅ PASSED: Correct error thrown");
	await api.shutdown();
} catch (error) {
	console.log("   ❌ FAILED:", error.message);
	failedTests++;
}

// Test 16: Error - reloadApi() with invalid arguments
totalTests++;
console.log("\n📋 Test 16: Error - reloadApi() with invalid arguments");
try {
	const api = await slothlet({
		dir: join(__dirname, "../api_tests/api_test"),
		hotReload: true
	});

	let errors = 0;

	// Test non-string argument
	try {
		await api.reloadApi(123);
	} catch (error) {
		if (error.message.includes("must be a string")) errors++;
	}

	// Test empty string
	try {
		await api.reloadApi("");
	} catch (error) {
		if (error.message.includes("non-empty")) errors++;
	}

	// Test whitespace-only string
	try {
		await api.reloadApi("   ");
	} catch (error) {
		if (error.message.includes("non-whitespace")) errors++;
	}

	if (errors !== 3) {
		throw new Error(`Expected 3 errors, got ${errors}`);
	}

	console.log("   ✅ PASSED: All invalid arguments rejected correctly");
	await api.shutdown();
} catch (error) {
	console.log("   ❌ FAILED:", error.message);
	failedTests++;
}

// Test 17: Error - reloadApi() when hotReload disabled
totalTests++;
console.log("\n📋 Test 17: Error - reloadApi() when hotReload disabled");
try {
	const api = await slothlet({
		dir: join(__dirname, "../api_tests/api_test"),
		hotReload: false
	});

	let errorThrown = false;
	try {
		await api.reloadApi("test");
	} catch (error) {
		if (error.message.includes("hotReload must be enabled")) {
			errorThrown = true;
		}
	}

	if (!errorThrown) {
		throw new Error("reloadApi() should throw error when hotReload is disabled");
	}

	console.log("   ✅ PASSED: Correct error thrown");
	await api.shutdown();
} catch (error) {
	console.log("   ❌ FAILED:", error.message);
	failedTests++;
}

// Test 18: reloadApi() on non-existent path (should not throw)
totalTests++;
console.log("\n📋 Test 18: reloadApi() on non-existent path");
try {
	const api = await slothlet({
		dir: join(__dirname, "../api_tests/api_test"),
		hotReload: true
	});

	// Should not throw - just does nothing
	await api.reloadApi("nonExistentPath");

	console.log("   ✅ PASSED: No error thrown for non-existent path");
	await api.shutdown();
} catch (error) {
	console.log("   ❌ FAILED:", error.message);
	failedTests++;
}

// Test 19: Nested API reloads
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName) => {
		// Add nested APIs
		await api.addApi("features.core", join(__dirname, "../api_tests/api_test"), {}, { moduleId: "core" });
		await api.addApi("features.extra", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "extra" });

		// Reload just features.core
		await api.reloadApi("features.core");

		// Both should still be accessible
		if (typeof api.features?.core?.math?.add !== "function") {
			throw new Error(`[${configName}] features.core.math.add not available after reloadApi`);
		}
		if (typeof api.features?.extra?.mathCjs !== "object") {
			throw new Error(`[${configName}] features.extra should remain intact after reloadApi("features.core")`);
		}
	},
	"Test 19: Nested API reloads"
);
if (result.failed > 0) failedTests++;

// Test 20: Concurrent reload operations
totalTests++;
console.log("\n📋 Test 20: Concurrent reload operations");
try {
	const api = await slothlet({
		dir: join(__dirname, "../api_tests/api_test"),
		hotReload: true
	});

	await api.addApi("extra1", join(__dirname, "../api_tests/api_test_mixed"), {}, { moduleId: "module-1" });
	await api.addApi("extra2", join(__dirname, "../api_tests/api_test"), {}, { moduleId: "module-2" });

	// Run multiple reloadApi calls concurrently
	await Promise.all([api.reloadApi("extra1"), api.reloadApi("extra2")]);

	// Verify both are still functional
	if (typeof api.extra1?.mathCjs !== "object" || typeof api.extra2?.math?.add !== "function") {
		throw new Error("APIs not functional after concurrent reloadApi calls");
	}

	console.log("   ✅ PASSED: Concurrent reloads handled correctly");
	await api.shutdown();
} catch (error) {
	console.log("   ❌ FAILED:", error.message);
	failedTests++;
}

// Test 21: mutateExisting preserves deeply nested references
// Note: References can only be preserved for MATERIALIZED content.
// In lazy mode, you must call a function to materialize before storing a reference.
totalTests++;
result = await runTestMatrix(
	{ hotReload: true },
	async (api, configName, fullConfig) => {
		// Add API
		await api.addApi("deep", join(__dirname, "../api_tests/api_test"), {}, { moduleId: "deep-test" });

		// In lazy mode, we must materialize before storing references
		// (you can't hold a reference to something that doesn't exist yet)
		if (fullConfig.lazy) {
			// Materialize by calling a function
			await api.deep.math.add(1, 1);
		}

		// Store deep references (now materialized in both modes)
		const mathRef = api.deep?.math;
		const addRef = api.deep?.math?.add;

		// Reload with mutateExisting via reloadApi
		await api.reloadApi("deep");

		// References should be preserved
		if (api.deep?.math !== mathRef) {
			throw new Error(`[${configName}] Nested object reference not preserved with mutateExisting`);
		}
		if (api.deep?.math?.add !== addRef) {
			throw new Error(`[${configName}] Deeply nested function reference not preserved with mutateExisting`);
		}
	},
	"Test 21: mutateExisting preserves deeply nested references"
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
