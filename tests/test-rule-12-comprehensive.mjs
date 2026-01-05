/**
 * @fileoverview Comprehensive Rule 12 test using matrix testing approach
 * @module test-rule-12-comprehensive
 * @description
 * Tests Rule 12 (Module Ownership and Selective API Overwriting) across all
 * meaningful slothlet configuration combinations to ensure consistent behavior.
 */

import { pathToFileURL } from "url";
import { runOwnershipTestMatrix, runSelectTestMatrix } from "./test-helper.mjs";

/**
 * Test Rule 12 ownership tracking across all ownership-enabled configurations
 * @private
 */
async function testRule12OwnershipTracking() {
	const results = await runOwnershipTestMatrix(
		{},
		async (api, configName, _) => {
			// Test 1: Module can register and update its own APIs
			await api.addApi(
				"plugins.moduleA",
				"../api_tests/api_test_mixed",
				{},
				{
					moduleId: "moduleA",
					forceOverwrite: true
				}
			);

			// Test 2: Module can hot-reload its own APIs
			await api.addApi(
				"plugins.moduleA",
				"../api_tests/api_test",
				{},
				{
					moduleId: "moduleA",
					forceOverwrite: true
				}
			);

			// Test 3: Register different module
			await api.addApi(
				"plugins.moduleB",
				"../api_tests/api_test_collections",
				{},
				{
					moduleId: "moduleB",
					forceOverwrite: true
				}
			);

			// Test 4: Cross-module overwrite should fail
			let crossModuleBlocked = false;
			try {
				await api.addApi(
					"plugins.moduleB",
					"../api_tests/api_test",
					{},
					{
						moduleId: "moduleA", // moduleA trying to overwrite moduleB's APIs
						forceOverwrite: true
					}
				);
			} catch (error) {
				if (error.message.includes("owned by module") && error.message.includes("moduleB")) {
					crossModuleBlocked = true;
				}
			}

			if (!crossModuleBlocked) {
				throw new Error(`Cross-module overwrite should have been blocked in ${configName}`);
			}
		},
		"Rule 12 Ownership Tracking Test"
	);

	return results;
}

/**
 * Test Rule 12 configuration validation requirements
 * @private
 */
async function testRule12ConfigurationValidation() {
	console.log("\n⚙️  Testing Rule 12 configuration validation...");

	// Test against basic configs that don't have enableModuleOwnership
	const results = await runSelectTestMatrix(["EAGER_BASIC", "LAZY_BASIC", "EAGER_ALLOW_OVERWRITE"], {}, async (api, configName, _) => {
		// Test 1: forceOverwrite should require enableModuleOwnership
		let configValidationWorked = false;
		try {
			await api.addApi(
				"test.path",
				"../api_tests/api_test",
				{},
				{
					forceOverwrite: true,
					moduleId: "testModule" // Provide moduleId so it reaches enableModuleOwnership check
				}
			);
		} catch (error) {
			if (error.message.includes("forceOverwrite requires enableModuleOwnership")) {
				configValidationWorked = true;
			}
		}

		if (!configValidationWorked) {
			throw new Error(`Configuration validation should require enableModuleOwnership for forceOverwrite in ${configName}`);
		}
	});

	return results;
}

/**
 * Test Rule 12 moduleId requirement validation
 * @private
 */
async function testRule12ModuleIdRequirement() {
	console.log("\n🆔 Testing Rule 12 moduleId requirement...");

	const results = await runOwnershipTestMatrix({}, async (api, configName, _) => {
		// Test: forceOverwrite should require moduleId
		let moduleIdValidationWorked = false;
		try {
			await api.addApi(
				"test.path",
				"../api_tests/api_test",
				{},
				{
					forceOverwrite: true
					// Missing moduleId
				}
			);
		} catch (error) {
			if (error.message.includes("forceOverwrite requires moduleId parameter")) {
				moduleIdValidationWorked = true;
			}
		}

		if (!moduleIdValidationWorked) {
			throw new Error(`ModuleId validation should require moduleId parameter for forceOverwrite in ${configName}`);
		}
	});

	return results;
}

/**
 * Test Rule 12 interaction with allowApiOverwrite setting
 * @private
 */
async function testRule12AllowApiOverwriteInteraction() {
	console.log("\n🔄 Testing Rule 12 interaction with allowApiOverwrite...");

	// Test with configurations that have allowApiOverwrite: false
	const results = await runSelectTestMatrix(
		["EAGER_OWNERSHIP_DENY_OVERWRITE", "LAZY_OWNERSHIP_DENY_OVERWRITE"],
		{},
		async (api, configName, _) => {
			// Test 1: Normal addApi should still respect allowApiOverwrite: false
			await api.addApi("normal.test", "../api_tests/api_test");
			const originalApi = api.normal.test; // Capture original API

			// This should be silently skipped with a warning (not throw error)
			await api.addApi("normal.test", "../api_tests/api_test_mixed");

			// Verify the API was NOT overwritten
			if (api.normal.test !== originalApi) {
				throw new Error(`Normal overwrite should be blocked by allowApiOverwrite: false in ${configName}`);
			}

			// Test 2: Module ownership should work despite allowApiOverwrite: false
			await api.addApi(
				"ownership.test",
				"../api_tests/api_test",
				{},
				{
					moduleId: "testModule",
					forceOverwrite: true
				}
			);

			// Test 3: Same module should be able to update despite allowApiOverwrite: false
			await api.addApi(
				"ownership.test",
				"../api_tests/api_test_mixed",
				{},
				{
					moduleId: "testModule",
					forceOverwrite: true
				}
			);

			// Test 4: Cross-module protection should still work
			let crossModuleBlocked = false;
			try {
				await api.addApi(
					"ownership.test",
					"../api_tests/api_test_collections",
					{},
					{
						moduleId: "differentModule",
						forceOverwrite: true
					}
				);
			} catch (error) {
				if (error.message.includes("owned by module") && error.message.includes("testModule")) {
					crossModuleBlocked = true;
				}
			}

			if (!crossModuleBlocked) {
				throw new Error(`Cross-module protection should work regardless of allowApiOverwrite setting in ${configName}`);
			}
		}
	);

	return results;
}

/**
 * Main test execution function
 * @public
 */
async function runRule12ComprehensiveTests() {
	console.log("🚀 Starting comprehensive Rule 12 testing...");

	const testResults = {
		ownershipTracking: null,
		configurationValidation: null,
		moduleIdRequirement: null,
		allowApiOverwriteInteraction: null
	};

	try {
		// Run all test suites
		testResults.ownershipTracking = await testRule12OwnershipTracking();
		testResults.configurationValidation = await testRule12ConfigurationValidation();
		testResults.moduleIdRequirement = await testRule12ModuleIdRequirement();
		testResults.allowApiOverwriteInteraction = await testRule12AllowApiOverwriteInteraction();

		// Overall summary
		const totalTests = Object.values(testResults).reduce((sum, result) => sum + result.total, 0);
		const totalPassed = Object.values(testResults).reduce((sum, result) => sum + result.passed, 0);
		const totalFailed = Object.values(testResults).reduce((sum, result) => sum + result.failed, 0);

		console.log("\n🎯 COMPREHENSIVE RULE 12 TEST SUMMARY:");
		console.log(`   Total Configurations Tested: ${totalTests}`);
		console.log(`   Total Passed: ${totalPassed}`);
		console.log(`   Total Failed: ${totalFailed}`);
		console.log(`   Overall Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

		if (totalFailed === 0) {
			console.log("\n✅ Rule 12 implementation is robust across ALL slothlet configurations!");
			return true; // Indicate success
		} else {
			console.log("\n❌ Rule 12 has issues in some configurations:");
			Object.entries(testResults).forEach(([testName, result]) => {
				if (result.failed > 0) {
					console.log(`   ${testName}: ${result.failed} failures`);
					result.errors.forEach((error) => {
						console.log(`     - ${error.config}: ${error.error}`);
					});
				}
			});
			return false; // Indicate failure
		}
	} catch (error) {
		console.error("❌ Comprehensive testing failed:", error.message);
		console.error(error.stack);
		return false; // Indicate failure
	}
}

// Execute if run directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const success = await runRule12ComprehensiveTests();
	if (!success) {
		process.exit(1);
	}
}
