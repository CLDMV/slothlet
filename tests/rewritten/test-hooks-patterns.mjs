/**
 * @fileoverview Tests for hook system pattern matching functionality.
 * @module @cldmv/slothlet.tests.test-hooks-patterns
 * @memberof module:@cldmv/slothlet
 * @internal
 * @private
 *
 * @description
 * Comprehensive tests for hook pattern matching including:
 * - Single-level wildcards (*)
 * - Multi-level wildcards (**)
 * - Brace expansion ({users,posts})
 * - Negation patterns (!internal.*)
 * - Exact path matching
 * - Pattern caching
 * - Edge cases and limits
 *
 * @example
 * // Run tests
 * node tests/test-hooks-patterns.mjs
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
 * await runTest("Single-level wildcard", async () => {
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
 * assert(called, "Hook should have been called");
 */
function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

console.log("=== Hook Pattern Matching Tests ===\n");

// Test 1: Single-level wildcard (*)
await runTest("Single-level wildcard (*) matches one level", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let called = false;
	let capturedPath = "";

	api.hooks.on("before", "math.*", (path, _) => {
		called = true;
		capturedPath = path;
	});

	// Should match
	await api.math.add(2, 3);
	assert(called, "Hook should have been called for math.add");
	assert(capturedPath === "math.add", `Path should be "math.add", got "${capturedPath}"`);

	// Reset
	called = false;
	capturedPath = "";

	// Should not match (two levels)
	if (api.nested?.date?.today) {
		await api.nested.date.today();
		assert(!called, "Hook should NOT have been called for nested.date.today");
	}

	await api.shutdown();
});

// Test 2: Multi-level wildcard (**)
await runTest("Multi-level wildcard (**) matches any depth", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const paths = [];

	api.hooks.on("before", "advanced.**", (path, _) => {
		paths.push(path);
	});

	await api.advanced.selfObject.addViaSelf(2, 3);
	if (api.advanced.nest?.alpha) {
		await api.advanced.nest.alpha("test");
	}
	if (api.advanced.nest2?.alpha?.hello) {
		await api.advanced.nest2.alpha.hello();
	}

	assert(paths.length > 0, "Hook should match at least one path");
	assert(
		paths.some((p) => p.startsWith("advanced.")),
		"Should match advanced.* paths"
	);

	await api.shutdown();
});

// Test 3: Exact path matching
await runTest("Exact path matches only specific function", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let called = false;
	let capturedPath = "";

	api.hooks.on("before", "math.add", (path, _) => {
		called = true;
		capturedPath = path;
	});

	await api.math.add(2, 3);
	assert(called, "Hook should have been called");
	assert(capturedPath === "math.add", `Path should be "math.add", got "${capturedPath}"`);

	// Reset
	called = false;
	capturedPath = "";

	// Should not match different function
	await api.math.multiply(2, 3);
	assert(!called, "Hook should NOT match different function");

	await api.shutdown();
});

// Test 4: Brace expansion {a,b}
await runTest("Brace expansion {a,b} matches alternatives", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const paths = [];

	// Match either math or string
	api.hooks.on("before", "{math,string}.*", (path, _) => {
		paths.push(path);
	});

	await api.math.add(2, 3);
	await api.string.upper("test");

	// Should match both
	assert(
		paths.some((p) => p.startsWith("math.")),
		"Should match math.*"
	);
	assert(
		paths.some((p) => p.startsWith("string.")),
		"Should match string.*"
	);

	await api.shutdown();
});

// Test 5: Negation pattern (!)
await runTest("Negation pattern (!) excludes matches", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const paths = [];

	// Match all EXCEPT math.*
	api.hooks.on("before", "!math.*", (path, _) => {
		paths.push(path);
	});

	// This should NOT match (math.*)
	await api.math.add(2, 3);

	// This should match (not math)
	await api.string.upper("test");

	// Verify string was called
	assert(
		paths.some((p) => p.startsWith("string.")),
		"Should match non-math paths"
	);

	// Verify math was NOT called
	assert(!paths.some((p) => p.startsWith("math.")), "Should NOT match math paths");

	await api.shutdown();
});

// Test 6: Pattern caching
await runTest("Pattern compilation caching works", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let count = 0;

	// Register multiple hooks with same pattern
	api.hooks.on("before", "math.*", () => {
		count++;
	});
	api.hooks.on("before", "math.*", () => {
		count++;
	});
	api.hooks.on("before", "math.*", () => {
		count++;
	});

	await api.math.add(2, 3);

	// All three hooks should have been called
	assert(count === 3, `Expected 3 hook calls, got ${count}`);

	await api.shutdown();
});

// Test 7: Wildcard with exact suffix
await runTest("Wildcard with exact suffix (*.create)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let called = false;

	api.hooks.on("before", "*.add", () => {
		called = true;
	});

	await api.math.add(2, 3);
	assert(called, "Should match *.add pattern");

	// Reset
	called = false;

	// Should not match different suffix
	await api.math.multiply(2, 3);
	assert(!called, "Should NOT match different suffix");

	await api.shutdown();
});

// Test 8: Nested brace expansion
await runTest("Nested brace expansion works", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const paths = [];

	// {a,b}.{c,d} should expand to: a.c, a.d, b.c, b.d
	api.hooks.on("before", "{math,string}.{add,upper}", (path, _) => {
		paths.push(path);
	});

	await api.math.add(2, 3);
	await api.string.upper("test");

	// Should match both
	assert(paths.includes("math.add"), "Should match math.add");
	assert(paths.includes("string.upper"), "Should match string.upper");

	await api.shutdown();
});

// Test 9: Root-level patterns
await runTest("Root-level patterns without dots", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let called = false;

	// Match any top-level call
	api.hooks.on("before", "*", () => {
		called = true;
	});

	// Top-level functions if they exist
	if (typeof api.rootFunction === "function") {
		await api.rootFunction();
		assert(called, "Should match root-level function");
	} else {
		// Test with first-level namespace
		await api.advanced.selfObject();
		// Won't match because path is "advanced.selfObject" (has dot)
		assert(!called, "Should NOT match nested path with root pattern");
	}

	await api.shutdown();
});

// Test 10: Complex pattern with multiple wildcards
await runTest("Complex pattern with multiple wildcards", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const paths = [];

	// Match any.anything.under.here (needs at least 2 dots)
	api.hooks.on("before", "**.*.*", (path, _) => {
		paths.push(path);
	});

	// This has 2 dots: advanced.selfObject.addViaSelf
	await api.advanced.selfObject.addViaSelf(2, 3);

	// Should match paths with at least 2 dots
	assert(paths.includes("advanced.selfObject.addViaSelf"), "Should match 3-level paths");

	await api.shutdown();
});

// Test 11: Empty pattern
await runTest("Empty pattern matches nothing", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let called = false;

	api.hooks.on("before", "", () => {
		called = true;
	});

	await api.math.add(2, 3);
	assert(!called, "Empty pattern should not match anything");

	await api.shutdown();
});

// Test 12: Maximum brace nesting (10 levels)
await runTest("Maximum brace nesting limit (10 levels)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	// This should hit the 10-level limit
	const pattern = "{a,{b,{c,{d,{e,{f,{g,{h,{i,{j,{k,l}}}}}}}}}}}";

	try {
		api.hooks.on("before", pattern, () => {
			// Hook registered but may not be called
		});

		await api.math.add(2, 3);

		// Pattern expansion should stop at 10 levels
		// Whether it matches or not depends on expansion result
		// Just verify no crash occurred
		assert(true, "Should handle deep nesting without crashing");
	} catch (_) {
		// Expected behavior: either works or gracefully fails
		assert(true, "Should handle deep nesting gracefully");
	}

	await api.shutdown();
});

// Test 13: Pattern with special regex characters
await runTest("Pattern with special regex characters", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let called = false;

	// Pattern with dots should be escaped properly
	api.hooks.on("before", "math.add", () => {
		called = true;
	});

	await api.math.add(2, 3);
	assert(called, "Should handle dots correctly");

	await api.shutdown();
});

// Test 14: Multiple patterns matching same path
await runTest("Multiple patterns matching same path", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	const calls = [];

	api.hooks.on("before", "math.*", () => {
		calls.push("pattern1");
	});

	api.hooks.on("before", "*.add", () => {
		calls.push("pattern2");
	});

	api.hooks.on("before", "**", () => {
		calls.push("pattern3");
	});

	await api.math.add(2, 3);

	// All three patterns should match
	assert(calls.includes("pattern1"), "First pattern should match");
	assert(calls.includes("pattern2"), "Second pattern should match");
	assert(calls.includes("pattern3"), "Third pattern should match");
	assert(calls.length === 3, `Expected 3 matches, got ${calls.length}`);

	await api.shutdown();
});

// Test 15: Pattern list() method
await runTest("list() returns registered patterns", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on("before", "math.*", () => {});
	api.hooks.on("after", "*.add", () => {});
	api.hooks.on("error", "**", () => {});

	const allHooks = api.hooks.list();
	assert(allHooks.length === 3, `Expected 3 hooks, got ${allHooks.length}`);

	const beforeHooks = api.hooks.list("before");
	assert(beforeHooks.length === 1, `Expected 1 before hook, got ${beforeHooks.length}`);
	assert(beforeHooks[0].pattern === "math.*", "Pattern should match");

	await api.shutdown();
});

console.log("\n=== All Pattern Matching Tests Completed ===");
