/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-proxy-baseline.mjs
 *	@Date: 2025-11-04 16:21:26 -08:00 (1762302086)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-11-04 20:45:44 -08:00 (1762317944)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Baseline Test: Proxy Behavior Validation for Release 2.5.5
 *
 * This test validates that custom proxy objects work identically in both
 * lazy and eager modes after the proxy handling fixes.
 *
 * Test Case: LGTVControllers proxy with array-style access and named exports
 * - lg[0] should work (array-style access via proxy get handler)
 * - lg.clearCache should work (named export function)
 * - Both should work identically in lazy and eager modes
 * - Null values are treated as test failures
 */

import slothlet from "@cldmv/slothlet";
import { performance } from "perf_hooks";

console.log("🧪 Baseline Test: Proxy Behavior Validation");
console.log("=".repeat(60));

let passCount = 0;
let failCount = 0;

/**
 * Record a test result and update counters
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
 * Helper function to format test result comparisons with consistent emoji and JSON output
 */
function formatResultComparison(name, lazyResult, eagerResult, match) {
	console.log(`🔍 ${name}:`);
	console.log(`  Lazy:  ${lazyResult.success ? "✅" : "❌"} ${JSON.stringify(lazyResult.result)}`);
	console.log(`  Eager: ${eagerResult.success ? "✅" : "❌"} ${JSON.stringify(eagerResult.result)}`);
	console.log(`  Match: ${match ? "✅" : "❌"}`);
}

/**
 * Test the LGTVControllers proxy functionality
 */
async function testProxyBehavior(mode, api) {
	console.log(`\n📱 Testing ${mode.toUpperCase()} mode:`);
	console.log("-".repeat(40));

	const results = {
		mode,
		arrayAccess: { success: false, error: null, result: null },
		namedExport: { success: false, error: null, result: null },
		proxyType: null,
		proxyProperties: []
	};

	try {
		// Test proxy existence (null check)
		const proxyExists = api.devices.lg !== null && api.devices.lg !== undefined;
		recordTest(`${mode} proxy existence`, proxyExists, proxyExists ? "proxy object found" : "proxy is null/undefined");

		if (!proxyExists) {
			results.generalError = "Proxy object is null or undefined";
			return results;
		}

		// Test proxy type and structure
		results.proxyType = typeof api.devices.lg;
		results.proxyProperties = Object.getOwnPropertyNames(api.devices.lg);

		console.log(`  📊 Proxy type: ${results.proxyType}`);
		console.log(`  📊 Proxy properties: [${results.proxyProperties.join(", ")}]`);

		// Test 1: Array-style access (custom proxy behavior)
		try {
			console.log(`  🔍 Testing lg[0] (array-style access)...`);
			const startTime = performance.now();
			const controller0 = api.devices.lg[0];
			const endTime = performance.now();

			// Check for null result (explicit failure)
			const isValidResult = controller0 !== null && controller0 !== undefined;
			results.arrayAccess.success = isValidResult;
			results.arrayAccess.result = controller0;

			recordTest(
				`${mode} lg[0] array access`,
				isValidResult,
				isValidResult ? `result: ${JSON.stringify(controller0)}` : "returned null/undefined"
			);

			console.log(`  📊 lg[0] = ${JSON.stringify(controller0)}`);
			console.log(`  ⏱️  Execution time: ${(endTime - startTime).toFixed(3)}ms`);
		} catch (error) {
			results.arrayAccess.error = error.message;
			recordTest(`${mode} lg[0] array access`, false, `threw error: ${error.message}`);
		}

		// Test 2: Named export function (standard property access)
		try {
			console.log(`  🔍 Testing lg.getStatus('tv1') (named export)...`);
			const startTime = performance.now();
			const statusResult = await api.devices.lg.getStatus("tv1");
			const endTime = performance.now();

			// Check for null result (explicit failure)
			const isValidResult = statusResult !== null && statusResult !== undefined;
			results.namedExport.success = isValidResult;
			results.namedExport.result = statusResult;

			recordTest(
				`${mode} lg.getStatus() method call`,
				isValidResult,
				isValidResult ? `result: ${JSON.stringify(statusResult)}` : "returned null/undefined"
			);

			console.log(`  📊 lg.getStatus('tv1') = ${JSON.stringify(statusResult)}`);
			console.log(`  ⏱️  Execution time: ${(endTime - startTime).toFixed(3)}ms`);
		} catch (error) {
			results.namedExport.error = error.message;
			recordTest(`${mode} lg.getStatus() method call`, false, `threw error: ${error.message}`);
		}
	} catch (error) {
		console.log(`  💥 General error in ${mode} mode: ${error.message}`);
		results.generalError = error.message;
		recordTest(`${mode} general proxy access`, false, `general error: ${error.message}`);
	}

	return results;
}

/**
 * Main test execution
 */
async function runBaselineTest() {
	const testDir = "./api_tests/api_tv_test";

	console.log(`📁 Test directory: ${testDir}`);
	console.log(`🎯 Target: api.devices.lg (LGTVControllers proxy)`);

	let lazyResults, eagerResults;

	// Test 1: Lazy Mode
	try {
		console.log(`\n🚀 Loading API in LAZY mode...`);
		const lazyStartTime = performance.now();
		const lazyApi = await slothlet({ dir: testDir, eager: false });
		const lazyLoadTime = performance.now() - lazyStartTime;

		console.log(`⚡ Lazy mode load time: ${lazyLoadTime.toFixed(3)}ms`);
		lazyResults = await testProxyBehavior("lazy", lazyApi);
	} catch (error) {
		console.log(`💥 Failed to load lazy API: ${error.message}`);
		lazyResults = { mode: "lazy", loadError: error.message };
	}

	// Test 2: Eager Mode
	try {
		console.log(`\n🚀 Loading API in EAGER mode...`);
		const eagerStartTime = performance.now();
		const eagerApi = await slothlet({ dir: testDir, eager: true });
		const eagerLoadTime = performance.now() - eagerStartTime;

		console.log(`⚡ Eager mode load time: ${eagerLoadTime.toFixed(3)}ms`);
		eagerResults = await testProxyBehavior("eager", eagerApi);
	} catch (error) {
		console.log(`💥 Failed to load eager API: ${error.message}`);
		eagerResults = { mode: "eager", loadError: error.message };
	}

	// Compare Results
	console.log(`\n📊 COMPARISON RESULTS`);
	console.log("=".repeat(60));

	const comparison = {
		bothLoaded: !lazyResults.loadError && !eagerResults.loadError,
		arrayAccessMatch: false,
		namedExportMatch: false,
		behaviorIdentical: false
	};

	if (comparison.bothLoaded) {
		// Compare array access results
		comparison.arrayAccessMatch =
			lazyResults.arrayAccess.success === eagerResults.arrayAccess.success &&
			JSON.stringify(lazyResults.arrayAccess.result) === JSON.stringify(eagerResults.arrayAccess.result);

		// Compare named export results (deep comparison for objects)
		comparison.namedExportMatch =
			lazyResults.namedExport.success === eagerResults.namedExport.success &&
			JSON.stringify(lazyResults.namedExport.result) === JSON.stringify(eagerResults.namedExport.result);

		comparison.behaviorIdentical = comparison.arrayAccessMatch && comparison.namedExportMatch;

		// Record comparison test results
		recordTest(
			"lazy vs eager array access match",
			comparison.arrayAccessMatch,
			comparison.arrayAccessMatch ? "both modes return same results" : "different results between modes"
		);

		recordTest(
			"lazy vs eager named export match",
			comparison.namedExportMatch,
			comparison.namedExportMatch ? "both modes return same results" : "different results between modes"
		);

		recordTest(
			"overall behavior identical",
			comparison.behaviorIdentical,
			comparison.behaviorIdentical ? "proxy behavior is identical between modes" : "proxy behavior differs between modes"
		);

		formatResultComparison("Array access (lg[0])", lazyResults.arrayAccess, eagerResults.arrayAccess, comparison.arrayAccessMatch);

		console.log("");
		formatResultComparison(
			"Named export (lg.getStatus('tv1'))",
			lazyResults.namedExport,
			eagerResults.namedExport,
			comparison.namedExportMatch
		);

		console.log(`\n🎯 OVERALL RESULT: ${comparison.behaviorIdentical ? "✅ IDENTICAL BEHAVIOR" : "❌ BEHAVIOR MISMATCH"}`);

		if (!comparison.behaviorIdentical) {
			console.log(`\n🔧 DEBUGGING INFO:`);
			console.log(`Lazy proxy type: ${lazyResults.proxyType}, properties: [${lazyResults.proxyProperties.join(", ")}]`);
			console.log(`Eager proxy type: ${eagerResults.proxyType}, properties: [${eagerResults.proxyProperties.join(", ")}]`);

			if (!comparison.arrayAccessMatch && lazyResults.arrayAccess.error) {
				console.log(`Lazy array access error: ${lazyResults.arrayAccess.error}`);
			}
			if (!comparison.arrayAccessMatch && eagerResults.arrayAccess.error) {
				console.log(`Eager array access error: ${eagerResults.arrayAccess.error}`);
			}
		}
	} else {
		recordTest("both modes loaded successfully", false, "one or both modes failed to load");
		console.log(`❌ Could not compare - loading failed`);
		if (lazyResults.loadError) console.log(`  Lazy error: ${lazyResults.loadError}`);
		if (eagerResults.loadError) console.log(`  Eager error: ${eagerResults.loadError}`);
	}

	// Final Summary
	console.log(`\n🏁 BASELINE TEST SUMMARY`);
	console.log("=".repeat(60));
	console.log(`✅ Passed: ${passCount}`);
	console.log(`❌ Failed: ${failCount}`);
	console.log(`📊 Total: ${passCount + failCount}`);
	console.log(`✨ Proxy fix status: ${comparison.behaviorIdentical ? "WORKING" : "NEEDS ATTENTION"}`);
	console.log(`📈 Ready for release: ${comparison.behaviorIdentical ? "YES" : "NO"}`);

	if (comparison.behaviorIdentical) {
		console.log(`🎉 Success! Both modes handle the LGTVControllers proxy identically.`);
		console.log(`🚀 The proxy behavior fix is working correctly for release 2.5.5.`);
	} else {
		console.log(`⚠️  Warning: Proxy behavior differs between modes.`);
		console.log(`🔧 Additional investigation required before release.`);
	}

	return comparison;
}

// Execute the baseline test
runBaselineTest()
	.then(() => {
		if (failCount > 0) {
			console.log(`\n❌ ${failCount} test(s) failed!`);
			process.exit(1);
		} else {
			console.log(`\n✅ All tests passed!`);
			process.exit(0);
		}
	})
	.catch((error) => {
		console.error(`💥 Test execution failed: ${error.message}`);
		console.error(error.stack);
		process.exit(1);
	});
