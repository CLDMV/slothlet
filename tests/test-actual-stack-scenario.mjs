/**
 * @fileoverview Test ACTUAL stack scenario from test-rule-12-comprehensive.mjs
 * @description Replicates exact pattern: closure defined here, executed through test-helper.mjs
 */

import { pathToFileURL } from "url";
import { runOwnershipTestMatrix } from "./test-helper.mjs";

console.log("🧪 Testing ACTUAL stack scenario from test-rule-12-comprehensive.mjs\n");
console.log("This file is at: tests/test-actual-stack-scenario.mjs");
console.log("Calling addApi with path: ../api_tests/api_test_mixed");
console.log("Expected resolution: api_tests/api_test_mixed (relative to project root)\n");

const results = await runOwnershipTestMatrix(
	{},
	async (api, configName) => {
		console.log(`\n📋 Testing in config: ${configName}`);
		console.log("   About to call addApi from closure defined in test-actual-stack-scenario.mjs");
		console.log("   Path: ../api_tests/api_test_mixed");
		console.log("   Watch the [DEBUG_RESOLVE] output to see what base file is detected...\n");

		try {
			await api.addApi(
				"test.path",
				"../api_tests/api_test_mixed",
				{},
				{
					moduleId: "testModule",
					forceOverwrite: true
				}
			);
			console.log("   ✅ SUCCESS: Path resolved correctly");
		} catch (error) {
			console.log(`   ❌ FAILED: ${error.message}`);
			throw error;
		}
	},
	"Actual Stack Scenario Test"
);

console.log("\n" + "=".repeat(60));
console.log("🎯 RESULTS:");
console.log(`   Passed: ${results.passed}`);
console.log(`   Failed: ${results.failed}`);
console.log("=".repeat(60));

if (results.failed > 0) {
	console.log("\n❌ Test failed - this replicates the CI failure!");
	process.exit(1);
} else {
	console.log("\n✅ Test passed - path resolution works correctly");
}
