/**
 * @fileoverview Tests for hooks suppressErrors option.
 * @module @cldmv/slothlet.tests.test-hooks-suppress-errors
 * @memberof module:@cldmv/slothlet
 * @internal
 * @private
 *
 * @description
 * Tests that the suppressErrors option correctly handles error throwing behavior:
 * - When false (default): Errors are sent to error hooks AND thrown
 * - When true: Errors are sent to error hooks ONLY, not thrown (returns undefined)
 *
 * Tests cover:
 * - Before hook errors with suppressErrors true/false
 * - Function errors with suppressErrors true/false
 * - After hook errors with suppressErrors true/false
 * - Always hook errors (never throw regardless)
 * - Cross-mode compatibility (eager/lazy × async/live)
 *
 * @example
 * // Run tests
 * node tests/test-hooks-suppress-errors.mjs
 */

import slothlet from "../../index.mjs";

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
		if (error.stack) {
			console.error(`  ${error.stack.split("\n").slice(1, 3).join("\n")}`);
		}
		failedTests++;
	}
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

console.log("=== Hooks suppressErrors Option Tests ===\n");

// ============================================================================
// DEFAULT BEHAVIOR: suppressErrors = false (errors throw normally)
// ============================================================================

await runTest("DEFAULT: Before hook error throws", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true // Default: suppressErrors = false
	});

	let errorHookCalled = false;

	api.hooks.on(
		"error",
		() => {
			errorHookCalled = true;
		},
		{ id: "error-monitor", pattern: "**" }
	);

	api.hooks.on(
		"before",
		() => {
			throw new Error("Before hook failed");
		},
		{ id: "failing-before", pattern: "math.add" }
	);

	let errorThrown = false;
	try {
		await api.math.add(2, 3);
	} catch (error) {
		errorThrown = true;
		assert(error.message === "Before hook failed", "Error message should match");
	}

	assert(errorThrown, "Error should have been thrown");
	assert(errorHookCalled, "Error hook should have been called");

	await api.shutdown();
});

await runTest("DEFAULT: Function error throws", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: { enabled: true } // Explicit: suppressErrors defaults to false
	});

	let errorHookCalled = false;

	api.hooks.on(
		"error",
		() => {
			errorHookCalled = true;
		},
		{ id: "error-monitor", pattern: "**" }
	);

	// Make the function throw by injecting error in before hook
	api.hooks.on(
		"before",
		() => {
			throw new Error("Function failed");
		},
		{ id: "inject-throw", pattern: "math.add" }
	);

	let errorThrown = false;
	try {
		await api.math.add(2, 3);
	} catch (error) {
		errorThrown = true;
		assert(error.message === "Function failed", "Error message should match");
	}

	assert(errorThrown, "Error should have been thrown");
	assert(errorHookCalled, "Error hook should have been called");

	await api.shutdown();
});

await runTest("DEFAULT: After hook error throws", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: { enabled: true, suppressErrors: false } // Explicit false
	});

	let errorHookCalled = false;

	api.hooks.on(
		"error",
		() => {
			errorHookCalled = true;
		},
		{ id: "error-monitor", pattern: "**" }
	);

	api.hooks.on(
		"after",
		() => {
			throw new Error("After hook failed");
		},
		{ id: "failing-after", pattern: "math.add" }
	);

	let errorThrown = false;
	try {
		await api.math.add(2, 3);
	} catch (error) {
		errorThrown = true;
		assert(error.message === "After hook failed", "Error message should match");
	}

	assert(errorThrown, "Error should have been thrown");
	assert(errorHookCalled, "Error hook should have been called");

	await api.shutdown();
});

// ============================================================================
// SUPPRESS ERRORS: suppressErrors = true (errors don't throw)
// ============================================================================

await runTest("SUPPRESS: Before hook error does NOT throw", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true // Suppress all errors
		}
	});

	let errorHookCalled = false;
	let errorContext = null;

	api.hooks.on(
		"error",
		(context) => {
			errorHookCalled = true;
			errorContext = context;
		},
		{ id: "error-monitor", pattern: "**" }
	);

	api.hooks.on(
		"before",
		() => {
			throw new Error("Before hook failed");
		},
		{ id: "failing-before", pattern: "math.add" }
	);

	// Should NOT throw
	const result = await api.math.add(2, 3);

	assert(result === undefined, "Function should return undefined when error suppressed");
	assert(errorHookCalled, "Error hook should have been called");
	assert(errorContext.error.message === "Before hook failed", "Error should be reported to hook");
	assert(errorContext.source.type === "before", "Source should be 'before'");

	await api.shutdown();
});

await runTest("SUPPRESS: Function error does NOT throw", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			pattern: "**",
			suppressErrors: true
		}
	});

	let errorHookCalled = false;
	let errorContext = null;

	api.hooks.on(
		"error",
		(context) => {
			errorHookCalled = true;
			errorContext = context;
		},
		{ id: "error-monitor", pattern: "**" }
	);

	// Inject function error via before hook
	api.hooks.on(
		"before",
		() => {
			throw new Error("Function execution failed");
		},
		{ id: "inject-error", pattern: "math.multiply" }
	);

	// Should NOT throw
	const result = await api.math.multiply(3, 4);

	assert(result === undefined, "Function should return undefined when error suppressed");
	assert(errorHookCalled, "Error hook should have been called");
	assert(errorContext.error.message === "Function execution failed", "Error should be reported");

	await api.shutdown();
});

await runTest("SUPPRESS: After hook error does NOT throw", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true
		}
	});

	let errorHookCalled = false;
	let errorContext = null;

	api.hooks.on(
		"error",
		(context) => {
			errorHookCalled = true;
			errorContext = context;
		},
		{ id: "error-monitor", pattern: "**" }
	);

	api.hooks.on(
		"after",
		() => {
			throw new Error("After hook failed");
		},
		{ id: "failing-after", pattern: "math.add" }
	);

	// Should NOT throw
	const result = await api.math.add(2, 3);

	assert(result === undefined, "Function should return undefined when error suppressed");
	assert(errorHookCalled, "Error hook should have been called");
	assert(errorContext.error.message === "After hook failed", "Error should be reported");
	assert(errorContext.source.type === "after", "Source should be 'after'");

	await api.shutdown();
});

await runTest("SUPPRESS: Always hook error never throws (baseline behavior)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true
		}
	});

	let errorHookCalled = false;

	api.hooks.on(
		"error",
		() => {
			errorHookCalled = true;
		},
		{ id: "error-monitor", pattern: "**" }
	);

	api.hooks.on(
		"always",
		() => {
			throw new Error("Always hook failed");
		},
		{ id: "failing-always", pattern: "math.add" }
	);

	// Should NOT throw (always hooks never throw)
	const result = await api.math.add(2, 3);

	assert(result === 5, "Function should execute normally");
	assert(errorHookCalled, "Error hook should have been called");

	await api.shutdown();
});

// ============================================================================
// MIXED BEHAVIOR: Some errors suppressed, some not
// ============================================================================

await runTest("SUPPRESS: Successful execution returns actual result", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true
		}
	});

	// No hooks that throw - should work normally
	const result = await api.math.add(10, 20);

	assert(result === 30, "Function should return actual result when no errors");

	await api.shutdown();
});

await runTest("SUPPRESS: Multiple functions, some fail, some succeed", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: {
			enabled: true,
			suppressErrors: true
		}
	});

	const errors = [];

	api.hooks.on(
		"error",
		(context) => {
			errors.push({ path: context.path, message: context.error.message });
		},
		{ id: "error-collector", pattern: "**" }
	);

	// Hook that fails only for add
	api.hooks.on(
		"before",
		({ path }) => {
			if (path === "math.add") {
				throw new Error("Add failed");
			}
		},
		{ id: "fail-add", pattern: "**" }
	);

	// Call multiple functions
	const result1 = await api.math.add(2, 3); // Should fail, return undefined
	const result2 = await api.math.multiply(2, 3); // Should succeed, return 6

	assert(result1 === undefined, "Failed function should return undefined");
	assert(result2 === 6, "Successful function should return actual result");
	assert(errors.length === 1, "Should have one error");
	assert(errors[0].path === "math.add", "Error should be for math.add");

	await api.shutdown();
});

// ============================================================================
// CROSS-MODE COMPATIBILITY
// ============================================================================

await runTest("SUPPRESS: Works in eager + async runtime", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		lazy: false,
		runtime: "async",
		hooks: { enabled: true, suppressErrors: true }
	});

	api.hooks.on(
		"before",
		() => {
			throw new Error("Test");
		},
		{ id: "fail", pattern: "**" }
	);
	const result = await api.math.add(1, 2);
	assert(result === undefined, "Should suppress in eager + async");

	await api.shutdown();
});

await runTest("SUPPRESS: Works in eager + live runtime", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		lazy: false,
		runtime: "live",
		hooks: { enabled: true, suppressErrors: true }
	});

	api.hooks.on(
		"before",
		() => {
			throw new Error("Test");
		},
		{ id: "fail", pattern: "**" }
	);
	const result = await api.math.add(1, 2);
	assert(result === undefined, "Should suppress in eager + live");

	await api.shutdown();
});

await runTest("SUPPRESS: Works in lazy + async runtime", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		lazy: true,
		runtime: "async",
		hooks: { enabled: true, suppressErrors: true }
	});

	api.hooks.on(
		"before",
		() => {
			throw new Error("Test");
		},
		{ id: "fail", pattern: "**" }
	);
	const result = await api.math.add(1, 2);
	assert(result === undefined, "Should suppress in lazy + async");

	await api.shutdown();
});

await runTest("SUPPRESS: Works in lazy + live runtime", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		lazy: true,
		runtime: "live",
		hooks: { enabled: true, suppressErrors: true }
	});

	api.hooks.on(
		"before",
		() => {
			throw new Error("Test");
		},
		{ id: "fail", pattern: "**" }
	);
	const result = await api.math.add(1, 2);
	assert(result === undefined, "Should suppress in lazy + live");

	await api.shutdown();
});

// ============================================================================
// EDGE CASES
// ============================================================================

await runTest("SUPPRESS: Can be toggled at runtime via disable/enable", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: { enabled: true, suppressErrors: true }
	});

	api.hooks.on(
		"fail",
		"before",
		() => {
			throw new Error("Test");
		},
		{ pattern: "**" }
	);

	// With hooks enabled - error suppressed
	const result1 = await api.math.add(1, 2);
	assert(result1 === undefined, "Error should be suppressed");

	// Disable hooks entirely - function should work
	api.hooks.disable();
	const result2 = await api.math.add(1, 2);
	assert(result2 === 3, "Function should work when hooks disabled");

	// Re-enable - error suppressed again
	api.hooks.enable();
	const result3 = await api.math.add(1, 2);
	assert(result3 === undefined, "Error should be suppressed again");

	await api.shutdown();
});

await runTest("SUPPRESS: Multiple error hooks all receive error", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: { enabled: true, suppressErrors: true }
	});

	let hook1Called = false;
	let hook2Called = false;
	let hook3Called = false;

	api.hooks.on(
		"error",
		() => {
			hook1Called = true;
		},
		{ id: "error1", pattern: "**" }
	);
	api.hooks.on(
		"error",
		() => {
			hook2Called = true;
		},
		{ id: "error2", pattern: "math.*" }
	);
	api.hooks.on(
		"error",
		() => {
			hook3Called = true;
		},
		{ id: "error3", pattern: "math.add" }
	);

	api.hooks.on(
		"before",
		() => {
			throw new Error("Test");
		},
		{ id: "fail", pattern: "math.add" }
	);

	await api.math.add(1, 2);

	assert(hook1Called, "Error hook 1 should be called");
	assert(hook2Called, "Error hook 2 should be called");
	assert(hook3Called, "Error hook 3 should be called");

	await api.shutdown();
});

console.log(`\n=== Test Results ===`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests > 0) {
	process.exit(1);
}

console.log("\n=== All suppressErrors Tests Completed Successfully ===");
