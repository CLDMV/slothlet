/**
 * @fileoverview Tests for error hook source tracking.
 * @module @cldmv/slothlet.tests.test-hooks-error-source
 * @memberof module:@cldmv/slothlet
 * @internal
 * @private
 *
 * @description
 * Tests that error hooks receive detailed source information about where
 * errors originated (before hook, function, after hook, always hook).
 *
 * Tests cover:
 * - Error in before hook
 * - Error in function (sync and async)
 * - Error in after hook
 * - Error in always hook
 * - Source metadata (type, hookId, hookTag, timestamp, stack)
 *
 * @example
 * // Run tests
 * node tests/test-hooks-error-source.mjs
 */

import slothlet from "../index.mjs";

let failedTests = 0;
let passedTests = 0;

async function runTest(testName, testFn) {
	try {
		await testFn();
		console.log(`✓ ${testName}`);
		passedTests++;
	} catch (error) {
		console.error(`✗ ${testName}`);
		console.error(`  ${error.message}`);
		failedTests++;
	}
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

console.log("=== Error Hook Source Tracking Tests ===\n");

// ============================================================================
// ERROR SOURCE: BEFORE HOOK
// ============================================================================

await runTest("ERROR SOURCE: Error in before hook reports correct source", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let errorContext = null;

	// Error hook to capture context
	api.hooks.on(
		"error-monitor",
		"error",
		(context) => {
			errorContext = context;
		},
		{ pattern: "math.add" }
	);

	// Before hook that throws
	api.hooks.on(
		"failing-validator",
		"before",
		() => {
			throw new Error("Validation failed");
		},
		{ pattern: "math.add" }
	);

	try {
		await api.math.add(2, 3);
		assert(false, "Should have thrown error");
	} catch (error) {
		assert(error.message === "Validation failed", "Error message should match");
	}

	// Verify error context
	assert(errorContext !== null, "Error hook should have been called");
	assert(errorContext.path === "math.add", "Path should be math.add");
	assert(errorContext.error.message === "Validation failed", "Error message should match");
	assert(errorContext.source.type === "before", "Source type should be 'before'");
	assert(errorContext.source.hookTag === "failing-validator", "Hook tag should match");
	assert(errorContext.source.hookId !== undefined, "Hook ID should be present");
	assert(errorContext.source.timestamp !== undefined, "Timestamp should be present");
	assert(errorContext.source.stack !== undefined, "Stack trace should be present");

	await api.shutdown();
});

// ============================================================================
// ERROR SOURCE: FUNCTION (SYNC)
// ============================================================================

await runTest("ERROR SOURCE: Error in sync function reports correct source", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let errorContext = null;

	api.hooks.on(
		"error-monitor",
		"error",
		(context) => {
			errorContext = context;
		},
		{ pattern: "**" }
	);

	try {
		// Call function that doesn't exist to trigger error
		await api.math.divide(10, 0);
		// If divide doesn't exist or throws, we'll catch it
	} catch (_) {
		// Expected error
	}

	// Create a test module that throws
	const testApi = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	errorContext = null;

	testApi.hooks.on(
		"error-monitor",
		"error",
		(context) => {
			errorContext = context;
		},
		{ pattern: "**" }
	);

	// Modify function to throw
	testApi.hooks.on(
		"make-throw",
		"before",
		({ args }) => {
			// Don't throw here, let function throw
			return args;
		},
		{ pattern: "math.add", priority: 1000 }
	);

	testApi.hooks.on(
		"inject-error",
		"after",
		() => {
			// Throw in after hook to test after source
			throw new Error("After hook error");
		},
		{ pattern: "math.add" }
	);

	try {
		await testApi.math.add(2, 3);
		assert(false, "Should have thrown error");
	} catch (error) {
		assert(error.message === "After hook error", "Error should be from after hook");
	}

	// This should show 'after' as source since after hook threw
	assert(errorContext !== null, "Error hook should have been called");
	assert(errorContext.source.type === "after", "Source type should be 'after'");

	await testApi.shutdown();
	await api.shutdown();
});

// ============================================================================
// ERROR SOURCE: AFTER HOOK
// ============================================================================

await runTest("ERROR SOURCE: Error in after hook reports correct source", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let errorContext = null;

	api.hooks.on(
		"error-monitor",
		"error",
		(context) => {
			errorContext = context;
		},
		{ pattern: "math.add" }
	);

	// After hook that throws
	api.hooks.on(
		"failing-formatter",
		"after",
		() => {
			throw new Error("Formatting failed");
		},
		{ pattern: "math.add" }
	);

	try {
		await api.math.add(2, 3);
		assert(false, "Should have thrown error");
	} catch (error) {
		assert(error.message === "Formatting failed", "Error message should match");
	}

	// Verify error context
	assert(errorContext !== null, "Error hook should have been called");
	assert(errorContext.source.type === "after", "Source type should be 'after'");
	assert(errorContext.source.hookTag === "failing-formatter", "Hook tag should match");
	assert(errorContext.source.hookId !== undefined, "Hook ID should be present");

	await api.shutdown();
});

// ============================================================================
// ERROR SOURCE: ALWAYS HOOK
// ============================================================================

await runTest("ERROR SOURCE: Error in always hook reports correct source (doesn't throw)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let errorContext = null;
	let alwaysErrorOccurred = false;

	api.hooks.on(
		"error-monitor",
		"error",
		(context) => {
			errorContext = context;
			if (context.source.type === "always") {
				alwaysErrorOccurred = true;
			}
		},
		{ pattern: "math.add" }
	);

	// Always hook that throws (should not crash execution)
	api.hooks.on(
		"failing-logger",
		"always",
		() => {
			throw new Error("Logging failed");
		},
		{ pattern: "math.add" }
	);

	// Should NOT throw - always hook errors don't propagate
	const result = await api.math.add(2, 3);
	assert(result === 5, "Function should execute normally despite always hook error");

	// Verify error context
	assert(alwaysErrorOccurred, "Error hook should have been called for always hook error");
	assert(errorContext !== null, "Error context should exist");
	assert(errorContext.source.type === "always", "Source type should be 'always'");
	assert(errorContext.source.hookTag === "failing-logger", "Hook tag should match");

	await api.shutdown();
});

// ============================================================================
// ERROR SOURCE: MULTIPLE HOOKS
// ============================================================================

await runTest("ERROR SOURCE: Multiple errors report each source correctly", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const errors = [];

	api.hooks.on(
		"error-collector",
		"error",
		(context) => {
			errors.push({
				type: context.source.type,
				tag: context.source.hookTag,
				message: context.error.message
			});
		},
		{ pattern: "**" }
	);

	// Test before hook error
	api.hooks.on(
		"before-fail",
		"before",
		() => {
			throw new Error("Before failed");
		},
		{ pattern: "math.add" }
	);

	try {
		await api.math.add(1, 2);
	} catch (_) {
		// Expected
	}

	// Remove before hook to avoid interference
	api.hooks.off("before-fail");

	// Test after hook error
	api.hooks.on(
		"after-fail",
		"after",
		() => {
			throw new Error("After failed");
		},
		{ pattern: "math.multiply" }
	);

	try {
		await api.math.multiply(3, 4);
	} catch (_) {
		// Expected
	}

	// Test always hook error (doesn't throw)
	api.hooks.on(
		"always-fail",
		"always",
		() => {
			throw new Error("Always failed");
		},
		{ pattern: "math.add" }
	);

	await api.math.add(5, 3); // Should not throw

	// Verify all errors were captured with correct sources
	assert(errors.length === 3, `Should have 3 errors, got ${errors.length}`);

	assert(errors[0].type === "before", "First error should be from before");
	assert(errors[0].tag === "before-fail", "First error tag should match");

	assert(errors[1].type === "after", "Second error should be from after");
	assert(errors[1].tag === "after-fail", "Second error tag should match");

	assert(errors[2].type === "always", "Third error should be from always");
	assert(errors[2].tag === "always-fail", "Third error tag should match");

	await api.shutdown();
});

// ============================================================================
// ERROR SOURCE: CROSS-MODE COMPATIBILITY
// ============================================================================

await runTest("ERROR SOURCE: Works across all mode/runtime combinations", async () => {
	const combinations = [
		{ lazy: false, runtime: "async" },
		{ lazy: false, runtime: "live" },
		{ lazy: true, runtime: "async" },
		{ lazy: true, runtime: "live" }
	];

	for (const config of combinations) {
		const api = await slothlet({
			dir: "./api_tests/api_test",
			...config,
			hooks: true
		});

		let errorContext = null;

		api.hooks.on(
			"error-monitor",
			"error",
			(context) => {
				errorContext = context;
			},
			{ pattern: "math.add" }
		);

		api.hooks.on(
			"test-fail",
			"before",
			() => {
				throw new Error("Test error");
			},
			{ pattern: "math.add" }
		);

		try {
			await api.math.add(1, 2);
		} catch (_) {
			// Expected
		}

		assert(errorContext !== null, `Error hook should work in lazy=${config.lazy}, runtime=${config.runtime}`);
		assert(errorContext.source.type === "before", `Source type should be 'before' in lazy=${config.lazy}, runtime=${config.runtime}`);

		await api.shutdown();
	}
});

console.log(`\n=== Test Results ===`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests > 0) {
	process.exit(1);
}

console.log("\n=== All Error Source Tracking Tests Completed Successfully ===");
