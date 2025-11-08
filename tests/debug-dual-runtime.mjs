/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/debug-dual-runtime.mjs
 *	@Date: 2025-11-07 12:00:00 -07:00 (1730924400)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-11-07 12:00:00 -07:00 (1730924400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

import chalk from "chalk";
import slothlet from "@cldmv/slothlet";

/**
 * Test live bindings functionality with self cross-calls and context access.
 * @param {object} api - The loaded slothlet API
 * @param {string} testLabel - Label for the test (e.g., "EAGER + AsyncLocalStorage")
 * @param {boolean} isLazy - Whether this is lazy mode (needs await)
 * @returns {Promise<object>} Test results
 */
async function testLiveBindings(api, testLabel, isLazy = false) {
	console.log(chalk.blueBright(`\n===== LIVE BINDINGS TEST: ${testLabel} =====`));

	// Dump API structure for debugging
	console.log(chalk.magentaBright("🔍 API Structure Analysis:"));
	console.log(chalk.gray(`   typeof api: ${typeof api}`));
	console.log(
		chalk.gray(
			`   api keys: [${Object.keys(api || {})
				.slice(0, 10)
				.join(", ")}${Object.keys(api || {}).length > 10 ? "..." : ""}]`
		)
	);

	if (api.math) {
		console.log(chalk.gray(`   api.math keys: [${Object.keys(api.math).join(", ")}]`));
		console.log(chalk.gray(`   api.math.add: ${typeof api.math.add}`));
	}

	if (api.advanced) {
		console.log(chalk.gray(`   api.advanced keys: [${Object.keys(api.advanced).join(", ")}]`));
		if (api.advanced.selfObject) {
			console.log(chalk.gray(`   api.advanced.selfObject keys: [${Object.keys(api.advanced.selfObject).join(", ")}]`));
			console.log(chalk.gray(`   api.advanced.selfObject.addViaSelf: ${typeof api.advanced.selfObject.addViaSelf}`));
		}
	}

	if (api.tcp) {
		console.log(chalk.gray(`   api.tcp keys: [${Object.keys(api.tcp).join(", ")}]`));
		console.log(chalk.gray(`   api.tcp.testContext: ${typeof api.tcp.testContext}`));
	}

	const results = {
		label: testLabel,
		selfCrossCall: { success: false, result: null, error: null },
		contextTest: { success: false, result: null, error: null },
		apiShape: {
			hasRootFunction: typeof api === "function",
			hasMath: !!api.math,
			hasAdvanced: !!api.advanced,
			hasTcp: !!api.tcp,
			hasSelfObject: !!api.advanced?.selfObject,
			hasTestContext: !!api.tcp?.testContext,
			mathAddType: api.math ? typeof api.math.add : "undefined",
			selfObjectAddType: api.advanced?.selfObject ? typeof api.advanced.selfObject.addViaSelf : "undefined"
		}
	};

	// Test 1: Self cross-call (self.math.add via advanced.selfObject.addViaSelf)
	try {
		console.log(chalk.cyanBright("🔄 Testing self cross-call..."));

		if (api.advanced?.selfObject?.addViaSelf) {
			// In lazy mode, we need to await function calls
			const crossCallResult = isLazy ? await api.advanced.selfObject.addViaSelf(5, 3) : api.advanced.selfObject.addViaSelf(5, 3);

			console.log(chalk.gray(`   Cross-call raw result: ${crossCallResult} (type: ${typeof crossCallResult})`));

			results.selfCrossCall.success = crossCallResult === 8;
			results.selfCrossCall.result = crossCallResult;

			if (results.selfCrossCall.success) {
				console.log(chalk.greenBright(`✅ Self cross-call successful: 5 + 3 = ${crossCallResult}`));
			} else {
				console.log(chalk.redBright(`❌ Self cross-call failed: expected 8, got ${crossCallResult}`));

				// Additional debugging for NaN results
				if (Number.isNaN(crossCallResult)) {
					console.log(chalk.yellowBright(`   🔍 NaN detected - checking self availability in addViaSelf...`));

					// Test direct math call for comparison
					if (api.math?.add) {
						const directMath = isLazy ? await api.math.add(5, 3) : api.math.add(5, 3);
						console.log(chalk.gray(`   Direct api.math.add(5, 3): ${directMath}`));
					}
				}
			}
		} else {
			results.selfCrossCall.error = "addViaSelf function not found";
			console.log(chalk.redBright(`❌ Self cross-call test skipped: addViaSelf function not found`));
		}
	} catch (error) {
		results.selfCrossCall.error = error.message;
		console.log(chalk.redBright(`❌ Self cross-call error: ${error.message}`));
	}

	// Test 2: Comprehensive Runtime Test
	try {
		console.log(chalk.cyanBright("🔄 Testing comprehensive runtime verification..."));

		if (api.runtimeTest?.comprehensiveRuntimeTest) {
			const runtimeResult = isLazy ? await api.runtimeTest.comprehensiveRuntimeTest() : api.runtimeTest.comprehensiveRuntimeTest();

			console.log(chalk.gray(`   Runtime verification result:`));
			console.log(chalk.gray(`     Runtime type detected: ${runtimeResult.verification.runtimeType}`));
			console.log(
				chalk.gray(
					`     Self available: ${runtimeResult.verification.selfTest.available} (${runtimeResult.verification.selfTest.keyCount} keys)`
				)
			);
			console.log(chalk.gray(`     Context available: ${runtimeResult.verification.contextTest.available}`));
			console.log(chalk.gray(`     Context user: ${runtimeResult.verification.contextTest.userData}`));
			console.log(chalk.gray(`     Isolation ID: ${runtimeResult.isolation.isolationId}`));
			console.log(chalk.gray(`     Cross-call success: ${runtimeResult.crossCall.success} (${runtimeResult.crossCall.actual})`));

			results.contextTest.result = runtimeResult;

			// Success criteria: runtime detection working + context isolation + cross-calls working
			const hasRuntimeDetection = runtimeResult.verification.runtimeType !== "unknown";
			const hasContextIsolation = runtimeResult.isolation.hasIsolationId;
			const hasCrossCall = runtimeResult.crossCall.success;

			results.contextTest.success = hasRuntimeDetection && hasContextIsolation && hasCrossCall;

			if (results.contextTest.success) {
				console.log(chalk.greenBright(`✅ Comprehensive runtime test successful:`));
				console.log(chalk.gray(`   Runtime detected: ${runtimeResult.verification.runtimeType}`));
				console.log(chalk.gray(`   Context isolation: ${hasContextIsolation ? "working" : "failed"}`));
				console.log(chalk.gray(`   Live bindings: ${hasCrossCall ? "working" : "failed"}`));
			} else {
				console.log(chalk.redBright(`❌ Comprehensive runtime test failed:`));
				console.log(
					chalk.gray(`   Runtime detection: ${hasRuntimeDetection ? "working" : "failed"} (${runtimeResult.verification.runtimeType})`)
				);
				console.log(chalk.gray(`   Context isolation: ${hasContextIsolation ? "working" : "failed"}`));
				console.log(chalk.gray(`   Cross-call: ${hasCrossCall ? "working" : "failed"}`));
			}
		} else {
			// Fallback to old context test
			console.log(chalk.yellowBright(`⚠️  Comprehensive runtime test not available, using fallback...`));
			if (api.tcp?.testContext) {
				const contextResult = isLazy ? await api.tcp.testContext() : api.tcp.testContext();
				console.log(chalk.gray(`   Fallback context result:`, JSON.stringify(contextResult, null, 2)));
				results.contextTest.result = contextResult;
				results.contextTest.success = contextResult.selfAvailable === true;
			} else {
				results.contextTest.error = "No runtime test methods available";
				console.log(chalk.redBright(`❌ No runtime test methods available`));
			}
		}
	} catch (error) {
		results.contextTest.error = error.message;
		console.log(chalk.redBright(`❌ Comprehensive runtime test error: ${error.message}`));
	}

	// Test 3: Basic API functionality
	console.log(chalk.cyanBright("🔄 Testing basic API functionality..."));
	try {
		if (api.math?.add) {
			const basicMath = isLazy ? await api.math.add(2, 3) : api.math.add(2, 3);
			console.log(chalk.greenBright(`✅ Basic math test: 2 + 3 = ${basicMath}`));
		}

		if (typeof api === "function") {
			const rootCall = isLazy ? await api("test") : api("test");
			console.log(chalk.greenBright(`✅ Root function test: api("test") = "${rootCall}"`));
		}
	} catch (error) {
		console.log(chalk.yellowBright(`⚠️  Basic API test warning: ${error.message}`));
	}

	return results;
}

/**
 * Run slothlet with specific configuration and test live bindings.
 * @param {object} config - Configuration for slothlet
 * @param {string} label - Label for this test run
 * @returns {Promise<object>} Test results and API instance
 */
async function runDualRuntimeTest(config, label) {
	console.log(chalk.yellowBright(`\n🚀 Starting test: ${label}`));
	console.log(chalk.gray(`   Config: ${JSON.stringify(config)}`));

	try {
		// Create slothlet instance with UNIQUE context for isolation testing
		const uniqueId = `${config.runtime}_${config.lazy ? "lazy" : "eager"}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const api = await slothlet({
			dir: "./api_tests/api_test",
			context: {
				user: `user-${uniqueId}`,
				testMode: true,
				runtimeTestId: uniqueId,
				expectedRuntime: config.runtime,
				timestamp: Date.now()
			},
			lazy: config.lazy,
			runtime: config.runtime
		});

		// Test live bindings
		const isLazy = config.lazy === true;
		const testResults = await testLiveBindings(api, label, isLazy);

		// Check if all critical tests passed
		const selfCrossCallOK = testResults.selfCrossCall.success;
		const contextTestOK = testResults.contextTest.success;

		// Verify runtime detection is correct
		const expectedRuntime = config.runtime;
		const detectedRuntime = testResults.contextTest.result?.verification?.runtimeType;
		const runtimeDetectionOK = detectedRuntime === expectedRuntime;

		const allTestsPass = selfCrossCallOK && contextTestOK && runtimeDetectionOK;

		if (!allTestsPass) {
			console.log(chalk.redBright(`❌ ${label} - Critical tests failed:`));
			if (!selfCrossCallOK) {
				console.log(chalk.red(`   ❌ Self cross-call: ${testResults.selfCrossCall.error || "failed"}`));
			}
			if (!contextTestOK) {
				console.log(chalk.red(`   ❌ Context test: ${testResults.contextTest.error || "failed"}`));
			}
			if (!runtimeDetectionOK) {
				console.log(chalk.red(`   ❌ Runtime detection: expected "${expectedRuntime}", got "${detectedRuntime}"`));
			}
		}

		return {
			config,
			label,
			api,
			testResults,
			success: allTestsPass
		};
	} catch (error) {
		console.log(chalk.redBright(`❌ Failed to create ${label} instance: ${error.message}`));
		console.log(chalk.gray(`   Full error details:`));
		console.log(chalk.gray(`   Name: ${error.name}`));
		console.log(chalk.gray(`   Message: ${error.message}`));
		if (error.stack) {
			console.log(chalk.gray(`   Stack trace:`));
			console.log(
				chalk.gray(
					error.stack
						.split("\n")
						.slice(0, 15)
						.map((line) => `     ${line}`)
						.join("\n")
				)
			);
		}
		if (error.cause) {
			console.log(chalk.gray(`   Caused by: ${error.cause.message || error.cause}`));
		}
		return {
			config,
			label,
			api: null,
			testResults: null,
			success: false,
			error: error.message
		};
	}
}

/**
 * Compare test results across different configurations.
 * @param {Array<object>} allResults - Array of test results from different configurations
 */
function compareResults(allResults) {
	console.log(chalk.yellowBright.bold("\n===== DUAL-RUNTIME COMPARISON RESULTS ====="));

	const successful = allResults.filter((r) => r.success);
	const failed = allResults.filter((r) => !r.success);

	if (failed.length > 0) {
		console.log(chalk.redBright(`❌ Failed configurations (${failed.length}):`));
		failed.forEach((result) => {
			console.log(chalk.red(`   - ${result.label}: ${result.error}`));
		});
		console.log();
	}

	if (successful.length > 0) {
		console.log(chalk.greenBright(`✅ Successful configurations (${successful.length}):`));
		successful.forEach((result) => {
			const { testResults } = result;
			const selfOk = testResults.selfCrossCall.success ? "✅" : "❌";
			const contextOk = testResults.contextTest.success ? "✅" : "❌";

			console.log(chalk.gray(`   - ${result.label}:`));
			console.log(
				chalk.gray(
					`     Self cross-call: ${selfOk} ${testResults.selfCrossCall.success ? testResults.selfCrossCall.result : testResults.selfCrossCall.error || "failed"}`
				)
			);
			console.log(
				chalk.gray(
					`     Context access: ${contextOk} ${testResults.contextTest.success ? "working" : testResults.contextTest.error || "failed"}`
				)
			);
		});
		console.log();
	}

	// Check consistency across modes
	if (successful.length >= 2) {
		console.log(chalk.blueBright("🔍 Consistency Analysis:"));

		const selfCallResults = successful.map((r) => r.testResults.selfCrossCall.result);
		const contextAvailable = successful.map((r) => r.testResults.contextTest.success);

		const allSelfCallsSame = selfCallResults.every((result) => result === selfCallResults[0]);
		const allContextSame = contextAvailable.every((available) => available === contextAvailable[0]);

		if (allSelfCallsSame && allContextSame) {
			console.log(chalk.greenBright("✅ All configurations produce consistent results"));
		} else {
			console.log(chalk.yellowBright("⚠️  Inconsistent results detected:"));
			if (!allSelfCallsSame) {
				console.log(chalk.yellow(`   Self cross-call results vary: ${selfCallResults.join(", ")}`));
			}
			if (!allContextSame) {
				console.log(chalk.yellow(`   Context availability varies: ${contextAvailable.join(", ")}`));
			}
		}
	}
}

// Main execution
(async () => {
	console.log(chalk.yellowBright.bold("\n===== DUAL-RUNTIME LIVE BINDINGS TEST ====="));
	console.log(chalk.cyanBright("Testing AsyncLocalStorage vs Experimental runtime with EAGER/LAZY modes...\n"));

	const testConfigurations = [
		// api_test - comprehensive dual-runtime testing
		{ lazy: false, runtime: "asynclocalstorage" },
		{ lazy: false, runtime: "experimental" },
		{ lazy: true, runtime: "asynclocalstorage" },
		{ lazy: true, runtime: "experimental" }
	];

	const allResults = [];

	// Run all test configurations
	for (const config of testConfigurations) {
		const modeLabel = config.lazy ? "LAZY" : "EAGER";
		const runtimeLabel = config.runtime === "experimental" ? "Experimental" : "AsyncLocalStorage";
		const fullLabel = `${modeLabel} + ${runtimeLabel}`;

		const result = await runDualRuntimeTest(config, fullLabel);
		allResults.push(result);

		// Shutdown the instance if created successfully
		if (result.success && result.api && typeof result.api.shutdown === "function") {
			try {
				await result.api.shutdown();
			} catch (error) {
				console.log(chalk.yellowBright(`⚠️  Shutdown warning for ${fullLabel}: ${error.message}`));
			}
		}
	}

	// Compare and analyze results
	compareResults(allResults);

	// Collect and display all errors prominently before summary
	const allErrors = [];
	allResults.forEach((result) => {
		const configLabel = `${result.config.lazy ? "LAZY" : "EAGER"} + ${result.config.runtime.toUpperCase()}`;

		if (result.error) {
			allErrors.push(`${configLabel}: Fatal Error - ${result.error}`);
		}

		if (result.testResults) {
			if (!result.testResults.selfCrossCall.success && result.testResults.selfCrossCall.error) {
				allErrors.push(`${configLabel}: Self Cross-Call Error - ${result.testResults.selfCrossCall.error}`);
			}

			if (!result.testResults.contextTest.success && result.testResults.contextTest.error) {
				allErrors.push(`${configLabel}: Context Test Error - ${result.testResults.contextTest.error}`);
			}
		}
	});

	// Display collected errors prominently
	if (allErrors.length > 0) {
		console.log(chalk.redBright.bold("\n🚨 ALL ERRORS COLLECTED:"));
		allErrors.forEach((error, index) => {
			console.log(chalk.red(`   ${index + 1}. ${error}`));
		});
	} else {
		console.log(chalk.greenBright.bold("\n✅ NO ERRORS DETECTED"));
	}

	// Final summary
	const successCount = allResults.filter((r) => r.success).length;
	const totalTests = allResults.length;

	console.log(chalk.yellowBright.bold("\n📋 DETAILED RESULTS SUMMARY:"));

	allResults.forEach((result) => {
		const mode = result.config.lazy ? "LAZY" : "EAGER";
		const runtime = result.config.runtime.toUpperCase();
		const status = result.success ? "✅" : "❌";

		console.log(chalk.cyan(`\n${status} ${mode} + ${runtime}:`));

		if (result.error) {
			console.log(chalk.red(`   💥 Fatal Error: ${result.error}`));
			return;
		}

		if (result.testResults) {
			// Self cross-call test
			const selfStatus = result.testResults.selfCrossCall.success ? "✅" : "❌";
			const selfDetail = result.testResults.selfCrossCall.success
				? `working (${result.testResults.selfCrossCall.result})`
				: `failed (${result.testResults.selfCrossCall.error})`;
			console.log(chalk.gray(`   ${selfStatus} Self cross-call: ${selfDetail}`));

			// Context test
			const contextStatus = result.testResults.contextTest.success ? "✅" : "❌";
			const contextDetail = result.testResults.contextTest.success
				? "working"
				: `failed (${result.testResults.contextTest.error || "context not available"})`;
			console.log(chalk.gray(`   ${contextStatus} Context test: ${contextDetail}`));

			// Runtime detection test
			const expectedRuntime = result.config.runtime;
			const detectedRuntime =
				result.testResults.contextTest.result?.verification?.runtimeType ||
				result.testResults.contextTest.result?.runtimeType ||
				"undefined";
			const runtimeMatch = detectedRuntime === expectedRuntime;
			const runtimeStatus = runtimeMatch ? "✅" : "❌";
			const runtimeDetail = runtimeMatch
				? `correct (${detectedRuntime})`
				: `wrong (expected "${expectedRuntime}", got "${detectedRuntime}")`;
			console.log(chalk.gray(`   ${runtimeStatus} Runtime detection: ${runtimeDetail}`));
		}
	});

	if (successCount === totalTests) {
		console.log(chalk.greenBright.bold(`\n🎉 All ${totalTests} dual-runtime configurations passed!`));
		process.exit(0);
	} else {
		console.log(chalk.redBright.bold(`\n💥 ${totalTests - successCount} of ${totalTests} configurations failed!`));
		process.exit(1);
	}
})().catch((error) => {
	console.error(chalk.redBright.bold("\n💥 Dual-runtime test crashed:"), error);
	process.exit(1);
});
