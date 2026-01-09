/**
 * @fileoverview Tests for always hooks receiving full execution context with error information.
 * @module tests/hooks-always-error-context
 *
 * @description
 * Verifies that always hooks receive complete context including:
 * - path: Function path
 * - result: Final result (undefined if error)
 * - hasError: Boolean indicating if errors occurred
 * - errors: Array of Error objects
 *
 * This allows a single always hook to handle both success and error scenarios
 * for unified logging, metrics, and monitoring.
 */

import slothlet from "../index.mjs";
import { strict as assert } from "assert";

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
	return fn()
		.then(() => {
			console.log(`✅ ${name}`);
			testsPassed++;
		})
		.catch((err) => {
			console.error(`❌ ${name}`);
			console.error(err);
			testsFailed++;
		});
}

// ==================================================================
// ALWAYS HOOK ERROR CONTEXT: SUCCESS SCENARIOS
// ==================================================================

await runTest("ALWAYS CONTEXT: Success execution provides empty errors array", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let alwaysContext = null;

	api.hooks.on(
		"observe-execution",
		"always",
		(context) => {
			alwaysContext = context;
		},
		{ pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result === 5, "Function should return correct result");
	assert(alwaysContext !== null, "Always hook should have been called");
	assert(alwaysContext.path === "math.add", "Context should have correct path");
	assert(alwaysContext.result === 5, "Context should have correct result");
	assert(alwaysContext.hasError === false, "hasError should be false on success");
	assert(Array.isArray(alwaysContext.errors), "errors should be an array");
	assert(alwaysContext.errors.length === 0, "errors array should be empty on success");

	await api.shutdown();
});

await runTest("ALWAYS CONTEXT: Short-circuit execution provides empty errors array", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let alwaysContext = null;

	// Before hook short-circuits
	api.hooks.on(
		"short-circuit",
		"before",
		() => {
			return 99; // Short-circuit
		},
		{ pattern: "math.add", priority: 200 }
	);

	api.hooks.on(
		"observe-execution",
		"always",
		(context) => {
			alwaysContext = context;
		},
		{ pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result === 99, "Should receive short-circuit value");
	assert(alwaysContext !== null, "Always hook should have been called");
	assert(alwaysContext.result === 99, "Context should have short-circuit result");
	assert(alwaysContext.hasError === false, "hasError should be false");
	assert(alwaysContext.errors.length === 0, "errors array should be empty");

	await api.shutdown();
});

// ==================================================================
// ALWAYS HOOK ERROR CONTEXT: ERROR SCENARIOS
// ==================================================================

await runTest("ALWAYS CONTEXT: Function error provides error in errors array", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true
		}
	});

	let alwaysContext = null;

	api.hooks.on(
		"observe-execution",
		"always",
		(context) => {
			alwaysContext = context;
		},
		{ pattern: "math.divide" }
	);

	// Divide by zero should throw
	const result = await api.math.divide(10, 0);

	assert(result === undefined, "Should return undefined when error suppressed");
	assert(alwaysContext !== null, "Always hook should have been called");
	assert(alwaysContext.path === "math.divide", "Context should have correct path");
	assert(alwaysContext.result === undefined, "Result should be undefined on error");
	assert(alwaysContext.hasError === true, "hasError should be true");
	assert(Array.isArray(alwaysContext.errors), "errors should be an array");
	assert(alwaysContext.errors.length === 1, "errors array should contain one error");
	assert(alwaysContext.errors[0] instanceof Error, "errors[0] should be an Error instance");
	assert(alwaysContext.errors[0].message.includes("divide by zero"), "Error message should mention divide by zero");

	await api.shutdown();
});

await runTest("ALWAYS CONTEXT: Unified logging with single always hook", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true
		}
	});

	const logs = [];

	// Single always hook handles both success and error logging
	api.hooks.on(
		"unified-logger",
		"always",
		({ path, result, hasError, errors }) => {
			if (hasError) {
				logs.push({
					type: "error",
					path,
					errorCount: errors.length,
					errorMessages: errors.map((e) => e.message)
				});
			} else {
				logs.push({
					type: "success",
					path,
					result
				});
			}
		},
		{ pattern: "math.*" }
	);

	// Success case
	await api.math.add(2, 3);

	// Error case
	await api.math.divide(10, 0);

	// Another success case
	await api.math.multiply(4, 5);

	assert(logs.length === 3, "Should have logged 3 executions");

	// Verify first log (success)
	assert(logs[0].type === "success", "First log should be success");
	assert(logs[0].path === "math.add", "First log should be math.add");
	assert(logs[0].result === 5, "First log should have correct result");

	// Verify second log (error)
	assert(logs[1].type === "error", "Second log should be error");
	assert(logs[1].path === "math.divide", "Second log should be math.divide");
	assert(logs[1].errorCount === 1, "Second log should have 1 error");
	assert(logs[1].errorMessages[0].includes("divide by zero"), "Second log should have divide by zero error");

	// Verify third log (success)
	assert(logs[2].type === "success", "Third log should be success");
	assert(logs[2].path === "math.multiply", "Third log should be math.multiply");
	assert(logs[2].result === 20, "Third log should have correct result");

	await api.shutdown();
});

await runTest("ALWAYS CONTEXT: Error context without suppressErrors (error propagates)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
		// suppressErrors: false (default)
	});

	let alwaysContext = null;

	api.hooks.on(
		"observe-execution",
		"always",
		(context) => {
			alwaysContext = context;
		},
		{ pattern: "math.divide" }
	);

	let caughtError = null;
	try {
		await api.math.divide(10, 0);
	} catch (error) {
		caughtError = error;
	}

	assert(caughtError !== null, "Error should have been thrown");
	assert(alwaysContext !== null, "Always hook should have been called before throw");
	assert(alwaysContext.hasError === true, "hasError should be true");
	assert(alwaysContext.errors.length === 1, "errors array should contain error");
	assert(alwaysContext.errors[0] === caughtError, "errors[0] should be the same error that was thrown");

	await api.shutdown();
});

// ==================================================================
// ALWAYS HOOK ERROR CONTEXT: METRICS/MONITORING USE CASE
// ==================================================================

await runTest("ALWAYS CONTEXT: Metrics tracking with error rates", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true
		}
	});

	const metrics = {
		calls: 0,
		successes: 0,
		errors: 0,
		totalDuration: 0
	};

	api.hooks.on(
		"metrics-tracker",
		"always",
		({ hasError }) => {
			metrics.calls++;
			if (hasError) {
				metrics.errors++;
			} else {
				metrics.successes++;
			}
		},
		{ pattern: "**" }
	);

	// Execute various operations
	await api.math.add(2, 3); // success
	await api.math.multiply(4, 5); // success
	await api.math.divide(10, 0); // error
	await api.math.add(7, 8); // success
	await api.math.divide(20, 0); // error

	assert(metrics.calls === 5, "Should have tracked 5 calls");
	assert(metrics.successes === 3, "Should have tracked 3 successes");
	assert(metrics.errors === 2, "Should have tracked 2 errors");

	const errorRate = (metrics.errors / metrics.calls) * 100;
	assert(errorRate === 40, `Error rate should be 40%, got ${errorRate}%`);

	await api.shutdown();
});

await runTest("ALWAYS CONTEXT: Error correlation tracking", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true
		}
	});

	const errorLog = [];

	api.hooks.on(
		"error-correlator",
		"always",
		({ path, hasError, errors }) => {
			if (hasError) {
				errorLog.push({
					path,
					timestamp: Date.now(),
					errorTypes: errors.map((e) => e.constructor.name),
					errorMessages: errors.map((e) => e.message)
				});
			}
		},
		{ pattern: "**" }
	);

	// Generate some errors
	await api.math.divide(10, 0);
	await api.math.divide(20, 0);

	assert(errorLog.length === 2, "Should have logged 2 errors");
	assert(errorLog[0].path === "math.divide", "First error should be from math.divide");
	assert(errorLog[1].path === "math.divide", "Second error should be from math.divide");
	assert(errorLog[0].errorTypes[0] === "Error", "Should track error type");
	assert(errorLog[0].errorMessages[0].includes("divide by zero"), "Should track error message");

	await api.shutdown();
});

// ==================================================================
// SUMMARY
// ==================================================================

console.log("\n" + "=".repeat(60));
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log("=".repeat(60));

if (testsFailed > 0) {
	process.exit(1);
}
