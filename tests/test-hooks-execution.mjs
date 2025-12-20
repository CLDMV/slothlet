/**
 * @fileoverview Tests for hook system execution behavior.
 * @module @cldmv/slothlet.tests.test-hooks-execution
 * @memberof module:@cldmv/slothlet
 * @internal
 * @private
 *
 * @description
 * Comprehensive tests for hook execution including:
 * - Priority ordering (higher priority = earlier execution)
 * - Registration order for same priority
 * - Before hook return behaviors (undefined/array/value)
 * - After hook result transformation chains
 * - Error hook execution and bubbling
 * - Promise handling
 * - All 4 mode/runtime combinations (lazy/eager × async/live)
 *
 * @example
 * // Run tests
 * node tests/test-hooks-execution.mjs
 */

import slothlet from "../index.mjs";

/**
 * Test helper to verify hook execution.
 *
 * @param {string} testName - Test name
 * @param {function} testFn - Test function
 * @returns {Promise<void>}
 * @private
 * @internal
 *
 * @description
 * Executes a test and reports pass/fail status.
 *
 * @example
 * // Internal usage
 * await runTest("Priority ordering", async () => {
 *   // test code
 * });
 */
async function runTest(testName, testFn) {
	try {
		await testFn();
		console.log(`✓ ${testName}`);
	} catch (error) {
		console.error(`✗ ${testName}`);
		console.error(`  ${error.message}`);
		if (error.stack) {
			console.error(`  ${error.stack.split("\n").slice(1, 3).join("\n")}`);
		}
	}
}

/**
 * Assertion helper.
 *
 * @param {boolean} condition - Condition to assert
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If condition is false
 * @private
 * @internal
 *
 * @description
 * Throws error with message if condition is falsy.
 *
 * @example
 * // Internal usage
 * assert(result === expected, "Result should match expected");
 */
function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

console.log("=== Hook Execution Behavior Tests ===\n");

// Test 1: Priority ordering - higher priority executes first
await runTest("Higher priority hooks execute first", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const execution = [];

	api.hooks.on(
		"before",
		"**",
		() => {
			execution.push("priority-100");
		},
		100
	);
	api.hooks.on(
		"before",
		"**",
		() => {
			execution.push("priority-200");
		},
		200
	);
	api.hooks.on(
		"before",
		"**",
		() => {
			execution.push("priority-50");
		},
		50
	);

	await api.math.add(2, 3);

	assert(execution.length === 3, `Expected 3 executions, got ${execution.length}`);
	assert(execution[0] === "priority-200", `First should be priority-200, got ${execution[0]}`);
	assert(execution[1] === "priority-100", `Second should be priority-100, got ${execution[1]}`);
	assert(execution[2] === "priority-50", `Third should be priority-50, got ${execution[2]}`);

	await api.shutdown();
});

// Test 2: Registration order for same priority
await runTest("Same priority uses registration order", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const execution = [];

	api.hooks.on(
		"before",
		"**",
		() => {
			execution.push("first");
		},
		100
	);
	api.hooks.on(
		"before",
		"**",
		() => {
			execution.push("second");
		},
		100
	);
	api.hooks.on(
		"before",
		"**",
		() => {
			execution.push("third");
		},
		100
	);

	await api.math.add(2, 3);

	assert(execution.length === 3, `Expected 3 executions, got ${execution.length}`);
	assert(execution[0] === "first", `First should be "first", got ${execution[0]}`);
	assert(execution[1] === "second", `Second should be "second", got ${execution[1]}`);
	assert(execution[2] === "third", `Third should be "third", got ${execution[2]}`);

	await api.shutdown();
});

// Test 3: Before hook returns undefined - continue
await runTest("Before hook returning undefined continues execution", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let hookCalled = false;
	let functionCalled = false;

	api.hooks.on("before", "math.add", () => {
		hookCalled = true;
		return undefined; // Explicitly return undefined
	});

	const result = await api.math.add(2, 3);

	functionCalled = result !== undefined; // If function executed, it returns something

	assert(hookCalled, "Hook should have been called");
	assert(functionCalled, "Function should have been called");

	await api.shutdown();
});

// Test 4: Before hook returns array - modify args
await runTest("Before hook returning array modifies arguments", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let capturedArgs = null;

	// Hook that modifies arguments
	api.hooks.on("before", "**", (path, args) => {
		// Return modified args
		return [...args, "modified"];
	});

	// Hook that captures final args
	api.hooks.on(
		"before",
		"**",
		(path, args) => {
			capturedArgs = args;
		},
		50
	); // Lower priority, runs after modification

	// Call a function that we can track args for
	await api.string.upper("original");
	assert(capturedArgs && capturedArgs.includes("modified"), "Args should include modified value");

	await api.shutdown();
});

// Test 5: Before hook returns value - short-circuit
await runTest("Before hook returning value short-circuits execution", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const shortCircuitValue = { shortCircuited: true, value: 42 };
	let secondHookCalled = false;

	api.hooks.on(
		"before",
		"math.add",
		() => {
			return shortCircuitValue; // Short-circuit
		},
		200
	);

	api.hooks.on(
		"before",
		"math.add",
		() => {
			secondHookCalled = true; // Should NOT be called
		},
		100
	);

	const result = await api.math.add(2, 3);

	assert(result === shortCircuitValue, "Should return short-circuit value");
	assert(!secondHookCalled, "Second hook should NOT have been called");

	await api.shutdown();
});

// Test 6: After hooks chain results
await runTest("After hooks chain result transformations", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// Chain of transformations
	api.hooks.on(
		"after",
		"**",
		(path, result) => {
			return { ...result, step1: true };
		},
		200
	);

	api.hooks.on(
		"after",
		"**",
		(path, result) => {
			return { ...result, step2: true };
		},
		100
	);

	api.hooks.on(
		"after",
		"**",
		(path, result) => {
			return { ...result, step3: true };
		},
		50
	);

	const result = await api.math.add(2, 3);

	assert(result && typeof result === "object", "Result should be an object");
	assert(result.step1 === true, "Should have step1");
	assert(result.step2 === true, "Should have step2");
	assert(result.step3 === true, "Should have step3");

	await api.shutdown();
});

// Test 7: Error hooks observe errors
await runTest("Error hooks are called on errors", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let errorCaptured = null;
	let pathCaptured = null;

	api.hooks.on("error", "**", (path, error, _) => {
		errorCaptured = error;
		pathCaptured = path;
	});

	// Trigger an error by calling a function that throws
	try {
		// Force an error
		api.hooks.on("before", "math.add", () => {
			throw new Error("Test error");
		});

		await api.math.add(2, 3);
		assert(false, "Should have thrown error");
	} catch (_) {
		assert(errorCaptured !== null, "Error hook should have captured error");
		assert(errorCaptured.message === "Test error", `Error message should be "Test error", got "${errorCaptured?.message}"`);
		assert(pathCaptured === "math.add", `Path should be "math.add", got "${pathCaptured}"`);
	}

	await api.shutdown();
});

// Test 8: Promise handling in async hooks
await runTest("Async hooks with Promises work correctly", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let asyncCompleted = false;

	api.hooks.on("before", "**", async () => {
		await new Promise((resolve) => setTimeout(resolve, 10));
		asyncCompleted = true;
	});

	await api.math.add(2, 3);

	assert(asyncCompleted, "Async hook should have completed");

	await api.shutdown();
});

// Test 9: Hook enable/disable functionality
await runTest("Disable/enable controls hook execution", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let hookCalled = false;

	api.hooks.on("before", "**", () => {
		hookCalled = true;
	});

	// Disable hooks
	api.hooks.disable();
	await api.math.add(2, 3);
	assert(!hookCalled, "Hook should NOT have been called when disabled");

	// Enable hooks
	api.hooks.enable();
	await api.math.add(2, 3);
	assert(hookCalled, "Hook should have been called after enabling");

	await api.shutdown();
});

// Test 10: Pattern-based enable/disable
await runTest("Pattern-based enable limits hook execution", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const calls = [];

	api.hooks.on("before", "**", (path) => {
		calls.push(path);
	});

	// Enable only math.* patterns
	api.hooks.enable("math.*");

	await api.math.add(2, 3);

	// Try calling something else
	await api.string.upper("test");

	// Only math.add should have been called
	assert(
		calls.some((c) => c === "math.add"),
		"Should include math.add"
	);
	assert(!calls.some((c) => c.startsWith("string.")), "Should NOT include string paths");

	await api.shutdown();
});

// Test 11: Off() removes hooks by ID
await runTest("off() removes hooks by ID", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let hook1Called = false;
	let hook2Called = false;

	const id1 = api.hooks.on("before", "**", () => {
		hook1Called = true;
	});
	api.hooks.on("before", "**", () => {
		hook2Called = true;
	});

	// Remove first hook
	api.hooks.off(id1);

	await api.math.add(2, 3);

	assert(!hook1Called, "First hook should NOT have been called");
	assert(hook2Called, "Second hook should have been called");

	await api.shutdown();
});

// Test 12: Off() removes hooks by pattern
await runTest("off() removes hooks by pattern", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let advancedHookCalled = false;
	let allHookCalled = false;

	api.hooks.on("before", "math.*", () => {
		advancedHookCalled = true;
	});
	api.hooks.on("before", "**", () => {
		allHookCalled = true;
	});

	// Remove math.* pattern
	api.hooks.off("math.*", "before");

	await api.math.add(2, 3);

	assert(!advancedHookCalled, "Advanced hook should NOT have been called");
	assert(allHookCalled, "All hook should still have been called");

	await api.shutdown();
});

// Test 13: Clear() removes all hooks
await runTest("clear() removes all hooks of type", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let beforeCalled = false;
	let afterCalled = false;

	api.hooks.on("before", "**", () => {
		beforeCalled = true;
	});
	api.hooks.on("after", "**", () => {
		afterCalled = true;
	});

	// Clear only before hooks
	api.hooks.clear("before");

	await api.math.add(2, 3);

	assert(!beforeCalled, "Before hook should NOT have been called");
	assert(afterCalled, "After hook should still have been called");

	await api.shutdown();
});

// Test 14: Lazy mode with hooks
await runTest("Hooks work in lazy mode", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		lazy: true,
		hooks: true
	});

	let hookCalled = false;

	api.hooks.on("before", "**", () => {
		hookCalled = true;
	});

	await api.advanced.selfObject();

	assert(hookCalled, "Hook should have been called in lazy mode");

	await api.shutdown();
});

// Test 15: Eager mode with hooks
await runTest("Hooks work in eager mode", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		lazy: false,
		hooks: true
	});

	let hookCalled = false;

	api.hooks.on("before", "**", () => {
		hookCalled = true;
	});

	await api.advanced.selfObject();

	assert(hookCalled, "Hook should have been called in eager mode");

	await api.shutdown();
});

// Test 16: Live runtime with hooks
await runTest("Hooks work with live runtime", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "live",
		hooks: true
	});

	let hookCalled = false;

	api.hooks.on("before", "**", () => {
		hookCalled = true;
	});

	await api.advanced.selfObject();

	assert(hookCalled, "Hook should have been called with live runtime");

	await api.shutdown();
});

// Test 17: Async runtime with hooks
await runTest("Hooks work with async runtime", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async",
		hooks: true
	});

	let hookCalled = false;

	api.hooks.on("before", "**", () => {
		hookCalled = true;
	});

	await api.advanced.selfObject();

	assert(hookCalled, "Hook should have been called with async runtime");

	await api.shutdown();
});

// Test 18: All 4 combinations (lazy/eager × async/live)
await runTest("Hooks work across all mode/runtime combinations", async () => {
	const combinations = [
		{ lazy: true, runtime: "async" },
		{ lazy: true, runtime: "live" },
		{ lazy: false, runtime: "async" },
		{ lazy: false, runtime: "live" }
	];

	for (const config of combinations) {
		const api = await slothlet({
			dir: "./api_tests/api_test",
			...config,
			hooks: true
		});

		let hookCalled = false;
		api.hooks.on("before", "**", () => {
			hookCalled = true;
		});

		await api.math.add(2, 3);

		assert(hookCalled, `Hook should work with lazy=${config.lazy}, runtime=${config.runtime}`);

		await api.shutdown();
	}
});

// Test 19: Multiple before hooks with mixed returns
await runTest("Multiple before hooks with mixed return types", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const execution = [];

	// First hook: continue (undefined)
	api.hooks.on(
		"before",
		"**",
		() => {
			execution.push("hook1");
			// Return undefined implicitly
		},
		300
	);

	// Second hook: modify args
	api.hooks.on(
		"before",
		"**",
		(path, args) => {
			execution.push("hook2");
			return [...args, "modified"];
		},
		200
	);

	// Third hook: should receive modified args
	api.hooks.on(
		"before",
		"**",
		(path, args) => {
			execution.push("hook3");
			assert(args.includes("modified"), "Should receive modified args");
		},
		100
	);

	await api.math.add(2, 3);

	assert(execution.length === 3, `Expected 3 hooks executed, got ${execution.length}`);
	assert(execution[0] === "hook1", "Hook order incorrect");
	assert(execution[1] === "hook2", "Hook order incorrect");
	assert(execution[2] === "hook3", "Hook order incorrect");

	await api.shutdown();
});

// Test 20: Hooks initialization with different config formats
await runTest("Hooks config formats: boolean, string, object", async () => {
	// Boolean true
	const api1 = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});
	assert(api1.hooks, "Should have hooks API with boolean true");
	await api1.shutdown();

	// String pattern
	const api2 = await slothlet({
		dir: "./api_tests/api_test",
		hooks: "advanced.*"
	});
	assert(api2.hooks, "Should have hooks API with string pattern");
	await api2.shutdown();

	// Object config
	const api3 = await slothlet({
		dir: "./api_tests/api_test",
		hooks: { enabled: true, pattern: "**" }
	});
	assert(api3.hooks, "Should have hooks API with object config");
	await api3.shutdown();

	// Boolean false
	const api4 = await slothlet({
		dir: "./api_tests/api_test",
		hooks: false
	});
	let hookCalled = false;
	if (api4.hooks) {
		api4.hooks.on("before", "**", () => {
			hookCalled = true;
		});
		await api4.math.add(2, 3);
	}
	assert(!hookCalled, "Hooks should be disabled with boolean false");
	await api4.shutdown();
});

console.log("\n=== All Execution Behavior Tests Completed ===");
