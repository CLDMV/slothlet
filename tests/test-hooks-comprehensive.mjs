/**
 * @fileoverview Comprehensive hook system tests covering advanced scenarios.
 * @module @cldmv/slothlet.tests.test-hooks-comprehensive
 * @memberof module:@cldmv/slothlet
 * @internal
 * @private
 *
 * @description
 * Exhaustive tests for hook system edge cases and advanced scenarios following
 * actual HookManager API: handler receives { path, args } or { path, result }.
 *
 * Tests cover:
 * - Multiple before hooks chaining argument modifications
 * - Multiple after hooks chaining result transformations
 * - Short-circuit verification with different value types
 * - Complex argument/result transformations
 * - Error handling in hook chains
 * - All mode/runtime combinations
 *
 * @example
 * // Run tests
 * node tests/test-hooks-comprehensive.mjs
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

function deepEqual(a, b) {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (typeof a !== "object" || typeof b !== "object") return false;

	const keysA = Object.keys(a);
	const keysB = Object.keys(b);

	if (keysA.length !== keysB.length) return false;

	for (const key of keysA) {
		if (!keysB.includes(key)) return false;
		if (!deepEqual(a[key], b[key])) return false;
	}

	return true;
}

console.log("=== Comprehensive Hook System Tests ===\n");

// ============================================================================
// ARGUMENT MODIFICATION PIPELINE TESTS
// ============================================================================

await runTest("PIPELINE: Multiple before hooks chain arg modifications (primitives)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const modifications = [];

	// Hook 1: Double the first argument (priority 300)
	api.hooks.on(
		"hook1-double",
		"before",
		({ _, args }) => {
			modifications.push("hook1");
			return [args[0] * 2, args[1]];
		},
		{ priority: 300, pattern: "math.add" }
	);

	// Hook 2: Add 10 to second argument (priority 200)
	api.hooks.on(
		"hook2-add10",
		"before",
		({ _, args }) => {
			modifications.push("hook2");
			return [args[0], args[1] + 10];
		},
		{ priority: 200, pattern: "math.add" }
	);

	// Hook 3: Swap arguments (priority 100)
	api.hooks.on(
		"hook3-swap",
		"before",
		({ _, args }) => {
			modifications.push("hook3");
			return [args[1], args[0]];
		},
		{ priority: 100, pattern: "math.add" }
	);

	// Call with (2, 3)
	// After hook1: (4, 3)
	// After hook2: (4, 13)
	// After hook3: (13, 4)
	// Result: 13 + 4 = 17
	const result = await api.math.add(2, 3);

	assert(modifications.length === 3, `Expected 3 hooks, got ${modifications.length}`);
	assert(modifications[0] === "hook1", "Hook 1 should execute first");
	assert(modifications[1] === "hook2", "Hook 2 should execute second");
	assert(modifications[2] === "hook3", "Hook 3 should execute third");
	assert(result === 17, `Expected 17, got ${result}`);

	await api.shutdown();
});

await runTest("PIPELINE: Multiple before hooks chain arg modifications (objects)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// Hook 1: Add property 'a'
	api.hooks.on(
		"add-a",
		"before",
		({ _, args }) => {
			if (typeof args[0] === "object") {
				return [{ ...args[0], a: 1 }, ...args.slice(1)];
			}
			return undefined;
		},
		{ priority: 300, pattern: "**" }
	);

	// Hook 2: Add property 'b'
	api.hooks.on(
		"add-b",
		"before",
		({ _, args }) => {
			if (typeof args[0] === "object") {
				return [{ ...args[0], b: 2 }, ...args.slice(1)];
			}
			return undefined;
		},
		{ priority: 200, pattern: "**" }
	);

	// Hook 3: Add property 'c'
	api.hooks.on(
		"add-c",
		"before",
		({ _, args }) => {
			if (typeof args[0] === "object") {
				return [{ ...args[0], c: 3 }, ...args.slice(1)];
			}
			return undefined;
		},
		{ priority: 100, pattern: "**" }
	);

	// Hook 4: Verify all properties (priority 50)
	let verified = false;
	api.hooks.on(
		"verify",
		"before",
		({ _, args }) => {
			if (typeof args[0] === "object") {
				verified = args[0].a === 1 && args[0].b === 2 && args[0].c === 3;
			}
		},
		{ priority: 50, pattern: "**" }
	);

	await api.math.add({ original: true }, 5);

	assert(verified, "All properties should be present");

	await api.shutdown();
});

await runTest("PIPELINE: Args modified through 5 hooks in sequence", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// Create 5 hooks that each multiply by 2
	for (let i = 0; i < 5; i++) {
		api.hooks.on(
			`multiply-${i}`,
			"before",
			({ _, args }) => {
				return [args[0] * 2, args[1] * 2];
			},
			{ priority: 500 - i * 100, pattern: "math.add" }
		);
	}

	// Call with (1, 1)
	// After 5 doublings: (32, 32)
	// Result: 64
	const result = await api.math.add(1, 1);

	assert(result === 64, `Expected 64, got ${result}`);

	await api.shutdown();
});

// ============================================================================
// RESULT TRANSFORMATION PIPELINE TESTS
// ============================================================================

await runTest("PIPELINE: Multiple after hooks chain result transformations (primitives)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const transformations = [];

	// Hook 1: Double result (priority 300)
	api.hooks.on(
		"double",
		"after",
		({ _, result }) => {
			transformations.push("hook1");
			return result * 2;
		},
		{ priority: 300, pattern: "math.add" }
	);

	// Hook 2: Add 5 (priority 200)
	api.hooks.on(
		"add5",
		"after",
		({ _, result }) => {
			transformations.push("hook2");
			return result + 5;
		},
		{ priority: 200, pattern: "math.add" }
	);

	// Hook 3: Convert to string (priority 100)
	api.hooks.on(
		"stringify",
		"after",
		({ _, result }) => {
			transformations.push("hook3");
			return `Result: ${result}`;
		},
		{ priority: 100, pattern: "math.add" }
	);

	// Call with (2, 3) -> function returns 5
	// After hook1: 10
	// After hook2: 15
	// After hook3: "Result: 15"
	const result = await api.math.add(2, 3);

	assert(transformations.length === 3, `Expected 3 transformations, got ${transformations.length}`);
	assert(result === "Result: 15", `Expected "Result: 15", got "${result}"`);

	await api.shutdown();
});

await runTest("PIPELINE: Multiple after hooks chain result transformations (objects)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// Hook 1: Wrap in object
	api.hooks.on(
		"wrap",
		"after",
		({ _, result }) => {
			return { value: result, step: 1 };
		},
		{ priority: 300, pattern: "math.add" }
	);

	// Hook 2: Add metadata
	api.hooks.on(
		"meta1",
		"after",
		({ _, result }) => {
			return { ...result, step: 2, doubled: result.value * 2 };
		},
		{ priority: 200, pattern: "math.add" }
	);

	// Hook 3: More metadata
	api.hooks.on(
		"meta2",
		"after",
		({ _, result }) => {
			return { ...result, step: 3, tripled: result.value * 3 };
		},
		{ priority: 100, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result.value === 5, "Original value should be 5");
	assert(result.step === 3, "Step should be 3");
	assert(result.doubled === 10, "Doubled should be 10");
	assert(result.tripled === 15, "Tripled should be 15");

	await api.shutdown();
});

await runTest("PIPELINE: Result transformed through 5 hooks in sequence", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// Create 5 hooks that each add 10
	for (let i = 0; i < 5; i++) {
		api.hooks.on(
			`add10-${i}`,
			"after",
			({ _, result }) => {
				return result + 10;
			},
			{ priority: 500 - i * 100, pattern: "math.add" }
		);
	}

	// Call with (2, 3) -> returns 5
	// After 5 additions of 10: 55
	const result = await api.math.add(2, 3);

	assert(result === 55, `Expected 55, got ${result}`);

	await api.shutdown();
});

// ============================================================================
// SHORT-CIRCUIT TESTS
// ============================================================================

await runTest("SHORT-CIRCUIT: Before hook with number prevents function execution", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let lowerPriorityHookCalled = false;

	// High priority: short-circuit
	api.hooks.on(
		"short-circuit",
		"before",
		(_) => {
			return 999; // Short-circuit with number
		},
		{ priority: 300, pattern: "math.add" }
	);

	// Lower priority: should NOT execute
	api.hooks.on(
		"lower",
		"before",
		(_) => {
			lowerPriorityHookCalled = true;
		},
		{ priority: 200, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result === 999, `Expected 999, got ${result}`);
	assert(!lowerPriorityHookCalled, "Lower priority hook should NOT execute");

	await api.shutdown();
});

await runTest("SHORT-CIRCUIT: Before hook with object short-circuits", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const shortCircuitObj = { custom: "response", value: 42 };
	let secondHookCalled = false;

	api.hooks.on(
		"object-return",
		"before",
		(_) => {
			return shortCircuitObj;
		},
		{ priority: 300, pattern: "math.add" }
	);

	api.hooks.on(
		"should-not-run",
		"before",
		({ path: ___path, args }) => {
			secondHookCalled = true;
		},
		{ priority: 200, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(deepEqual(result, shortCircuitObj), "Should return short-circuit object");
	assert(!secondHookCalled, "Second hook should NOT execute");

	await api.shutdown();
});

await runTest("SHORT-CIRCUIT: Before hook with string short-circuits", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let secondHookCalled = false;

	api.hooks.on(
		"string-return",
		"before",
		(_) => {
			return "SHORT_CIRCUIT";
		},
		{ priority: 300, pattern: "math.add" }
	);

	api.hooks.on(
		"should-not-run",
		"before",
		({ path: ___path, args }) => {
			secondHookCalled = true;
		},
		{ priority: 200, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result === "SHORT_CIRCUIT", `Expected "SHORT_CIRCUIT", got "${result}"`);
	assert(!secondHookCalled, "Second hook should NOT execute");

	await api.shutdown();
});

await runTest("SHORT-CIRCUIT: Before hook with null short-circuits", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let secondHookCalled = false;

	api.hooks.on(
		"null-return",
		"before",
		(_) => {
			return null;
		},
		{ priority: 300, pattern: "math.add" }
	);

	api.hooks.on(
		"should-not-run",
		"before",
		({ path: ___path, args }) => {
			secondHookCalled = true;
		},
		{ priority: 200, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result === null, `Expected null, got ${result}`);
	assert(!secondHookCalled, "Second hook should NOT execute");

	await api.shutdown();
});

await runTest("SHORT-CIRCUIT: Before hook with 0 short-circuits", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let secondHookCalled = false;

	api.hooks.on(
		"zero-return",
		"before",
		(_) => {
			return 0;
		},
		{ priority: 300, pattern: "math.add" }
	);

	api.hooks.on(
		"should-not-run",
		"before",
		({ path: ___path, args }) => {
			secondHookCalled = true;
		},
		{ priority: 200, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result === 0, `Expected 0, got ${result}`);
	assert(!secondHookCalled, "Second hook should NOT execute");

	await api.shutdown();
});

await runTest("SHORT-CIRCUIT: Before hook with false short-circuits", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let secondHookCalled = false;

	api.hooks.on(
		"false-return",
		"before",
		(_) => {
			return false;
		},
		{ priority: 300, pattern: "math.add" }
	);

	api.hooks.on(
		"should-not-run",
		"before",
		({ path: ___path, args }) => {
			secondHookCalled = true;
		},
		{ priority: 200, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result === false, `Expected false, got ${result}`);
	assert(!secondHookCalled, "Second hook should NOT execute");

	await api.shutdown();
});

await runTest("ALWAYS: Always hooks execute after short-circuit", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let alwaysHookCalled = false;
	let afterHookCalled = false;

	// Before hook short-circuits
	api.hooks.on(
		"before-short",
		"before",
		({ path: ___path, args }) => {
			return 99;
		},
		{ priority: 300, pattern: "math.add" }
	);

	// After hook should NOT execute after short-circuit
	api.hooks.on(
		"after-transform",
		"after",
		({ path: ___path, result }) => {
			afterHookCalled = true;
			return result * 2;
		},
		{ priority: 100, pattern: "math.add" }
	);

	// Always hook should ALWAYS execute
	api.hooks.on(
		"always-observe",
		"always",
		({ path: ___path, result }) => {
			alwaysHookCalled = true;
			assert(result === 99, "Always hook should receive short-circuit value");
		},
		{ priority: 50, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(alwaysHookCalled, "Always hook should have been called");
	assert(!afterHookCalled, "After hook should NOT have been called after short-circuit");
	assert(result === 99, `Expected 99, got ${result}`);

	await api.shutdown();
});

await runTest("ALWAYS: Always hooks execute after normal completion", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let alwaysHookCalled = false;
	let afterHookCalled = false;
	let receivedResult = null;

	// After hook transforms result
	api.hooks.on(
		"after-transform",
		"after",
		({ path: ___path, result }) => {
			afterHookCalled = true;
			return result * 2; // 5 → 10
		},
		{ priority: 100, pattern: "math.add" }
	);

	// Always hook should see FINAL result (after 'after' hooks)
	api.hooks.on(
		"always-observe",
		"always",
		({ path: ___path, result }) => {
			alwaysHookCalled = true;
			receivedResult = result;
		},
		{ priority: 50, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(alwaysHookCalled, "Always hook should have been called");
	assert(afterHookCalled, "After hook should have been called");
	assert(receivedResult === 10, `Always hook should see final result 10, got ${receivedResult}`);
	assert(result === 10, `Expected 10, got ${result}`);

	await api.shutdown();
});

await runTest("ALWAYS: Always hooks cannot modify result", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// Always hook tries to return a value (should be ignored)
	api.hooks.on(
		"always-try-modify",
		"always",
		({ path: ___path, result }) => {
			return 999; // This should be ignored
		},
		{ priority: 50, pattern: "math.add" }
	);

	const result = await api.math.add(2, 3);

	assert(result === 5, `Always hook should not modify result. Expected 5, got ${result}`);

	await api.shutdown();
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

await runTest("ERROR: Error in before hook is caught by error hook", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let errorCaptured = null;
	let pathCaptured = null;

	// Error hook
	api.hooks.on(
		"error-handler",
		"error",
		({ path, error }) => {
			errorCaptured = error;
			pathCaptured = path;
		},
		{ priority: 100, pattern: "**" }
	);

	// Before hook that throws
	api.hooks.on(
		"thrower",
		"before",
		({ path: ___path, args }) => {
			throw new Error("Test error");
		},
		{ priority: 300, pattern: "math.add" }
	);

	try {
		await api.math.add(2, 3);
		assert(false, "Should have thrown error");
	} catch (e) {
		assert(e.message === "Test error", `Expected "Test error", got "${e.message}"`);
	}

	assert(errorCaptured !== null, "Error hook should capture error");
	assert(errorCaptured.message === "Test error", "Error message should match");
	assert(pathCaptured === "math.add", `Expected "math.add", got "${pathCaptured}"`);

	await api.shutdown();
});

await runTest("ERROR: Multiple error hooks all execute", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const errorHooks = [];

	// Multiple error hooks
	api.hooks.on(
		"error1",
		"error",
		({ path: ___path, error }) => {
			errorHooks.push("hook1");
		},
		{ priority: 100, pattern: "**" }
	);

	api.hooks.on(
		"error2",
		"error",
		({ path: ___path, error }) => {
			errorHooks.push("hook2");
		},
		{ priority: 100, pattern: "**" }
	);

	api.hooks.on(
		"error3",
		"error",
		({ path: ___path, error }) => {
			errorHooks.push("hook3");
		},
		{ priority: 100, pattern: "**" }
	);

	// Before hook that throws
	api.hooks.on(
		"thrower",
		"before",
		({ path: ___path, args }) => {
			throw new Error("Test error");
		},
		{ priority: 300, pattern: "math.add" }
	);

	try {
		await api.math.add(2, 3);
	} catch (_) {
		// Expected
	}

	assert(errorHooks.length === 3, `Expected 3 error hooks, got ${errorHooks.length}`);

	await api.shutdown();
});

// ============================================================================
// COMPREHENSIVE MIXED SCENARIOS
// ============================================================================

await runTest("MIXED: Args modified, short-circuit, result transformed", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// Before hook: modify args
	api.hooks.on(
		"modify-args",
		"before",
		({ path: ___path, args }) => {
			return [10, 20];
		},
		{ priority: 300, pattern: "math.add" }
	);

	// After hook: transform result
	api.hooks.on(
		"transform-result",
		"after",
		({ path: ___path, result }) => {
			return { original: result, doubled: result * 2 };
		},
		{ priority: 100, pattern: "math.add" }
	);

	// Function receives (10, 20) and returns 30
	// After hook transforms to { original: 30, doubled: 60 }
	const result = await api.math.add(2, 3);

	assert(result.original === 30, `Expected 30, got ${result.original}`);
	assert(result.doubled === 60, `Expected 60, got ${result.doubled}`);

	await api.shutdown();
});

await runTest("MIXED: Before hooks modify args, after hooks chain transforms", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// Before: multiply args by 2
	api.hooks.on(
		"before1",
		"before",
		({ path: ___path, args }) => {
			return [args[0] * 2, args[1] * 2];
		},
		{ priority: 300, pattern: "math.add" }
	);

	// Before: add 5 to each arg
	api.hooks.on(
		"before2",
		"before",
		({ path: ___path, args }) => {
			return [args[0] + 5, args[1] + 5];
		},
		{ priority: 200, pattern: "math.add" }
	);

	// After: double result
	api.hooks.on(
		"after1",
		"after",
		({ path: ___path, result }) => {
			return result * 2;
		},
		{ priority: 300, pattern: "math.add" }
	);

	// After: add 100
	api.hooks.on(
		"after2",
		"after",
		({ path: ___path, result }) => {
			return result + 100;
		},
		{ priority: 200, pattern: "math.add" }
	);

	// Call with (1, 1)
	// After before1: (2, 2)
	// After before2: (7, 7)
	// Function: 14
	// After after1: 28
	// After after2: 128
	const result = await api.math.add(1, 1);

	assert(result === 128, `Expected 128, got ${result}`);

	await api.shutdown();
});

// ============================================================================
// ALL MODE/RUNTIME COMBINATIONS
// ============================================================================

await runTest("ALL MODES: Arg modification works across all combinations", async () => {
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

		api.hooks.on(
			"multiply-args",
			"before",
			({ path: ___path, args }) => {
				return [args[0] * 10, args[1] * 10];
			},
			{ priority: 100, pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		assert(result === 50, `Expected 50, got ${result} for lazy=${config.lazy}, runtime=${config.runtime}`);

		await api.shutdown();
	}
});

await runTest("ALL MODES: Result transformation works across all combinations", async () => {
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

		api.hooks.on(
			"multiply-result",
			"after",
			({ path: ___path, result }) => {
				return result * 10;
			},
			{ priority: 100, pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		assert(result === 50, `Expected 50, got ${result} for lazy=${config.lazy}, runtime=${config.runtime}`);

		await api.shutdown();
	}
});

await runTest("ALL MODES: Short-circuit works across all combinations", async () => {
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

		api.hooks.on(
			"short-circuit",
			"before",
			({ path: ___path, args }) => {
				return 999;
			},
			{ priority: 100, pattern: "math.add" }
		);

		const result = await api.math.add(2, 3);

		assert(result === 999, `Expected 999, got ${result} for lazy=${config.lazy}, runtime=${config.runtime}`);

		await api.shutdown();
	}
});

// ============================================================================
// ENABLE/DISABLE TESTS
// ============================================================================

await runTest("ENABLE/DISABLE: Hooks don't run when disabled", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on(
		"should-not-run",
		"before",
		({ path: ___path, args }) => {
			return [args[0] * 10, args[1] * 10];
		},
		{ priority: 100, pattern: "math.add" }
	);

	// Disable hooks
	api.hooks.disable();

	// Result should be unmodified (5) not modified (50)
	const result = await api.math.add(2, 3);
	assert(result === 5, `Expected 5 (hooks disabled), got ${result}`);

	await api.shutdown();
});

await runTest("ENABLE/DISABLE: Hooks can be re-enabled at runtime", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on(
		"toggle-test",
		"before",
		({ path: ___path, args }) => {
			return [args[0] * 10, args[1] * 10];
		},
		{ priority: 100, pattern: "math.add" }
	);

	// Initially enabled - hook should run
	const result1 = await api.math.add(2, 3);
	assert(result1 === 50, `Expected 50 (enabled), got ${result1}`);

	// Disable hooks
	api.hooks.disable();
	const result2 = await api.math.add(2, 3);
	assert(result2 === 5, `Expected 5 (disabled), got ${result2}`);

	// Re-enable hooks
	api.hooks.enable();
	const result3 = await api.math.add(2, 3);
	assert(result3 === 50, `Expected 50 (re-enabled), got ${result3}`);

	await api.shutdown();
});

await runTest("ENABLE/DISABLE: Pattern-specific enable works", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on(
		"pattern-test",
		"before",
		({ path: ___path, args }) => {
			return [args[0] * 10, args[1] * 10];
		},
		{ priority: 100, pattern: "math.*" }
	);

	// Disable all hooks first
	api.hooks.disable();

	// Enable only math.* pattern
	api.hooks.enable("math.*");

	// Should work since pattern is enabled
	const result = await api.math.add(2, 3);
	assert(result === 50, `Expected 50 (pattern enabled), got ${result}`);

	await api.shutdown();
});

console.log(`\n=== Test Results ===`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests > 0) {
	process.exit(1);
}

console.log("\n=== All Comprehensive Tests Completed Successfully ===");
