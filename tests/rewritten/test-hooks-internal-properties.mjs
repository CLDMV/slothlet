/**
 * @fileoverview Tests to verify that internal properties like api.hooks don't trigger hook execution.
 * @module tests/hooks-internal-properties
 *
 * @description
 * Verifies that accessing internal slothlet properties (hooks, __ctx, shutdown, _impl)
 * doesn't trigger hook execution inadvertently. These properties should be excluded
 * from hook path tracking and execution.
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
// INTERNAL PROPERTIES: HOOKS API ACCESS
// ==================================================================

await runTest("INTERNAL: Accessing api.hooks doesn't trigger hooks", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let hookExecuted = false;

	// Register a hook that matches everything
	api.hooks.on(
		"catch-all",
		"before",
		({ path }) => {
			hookExecuted = true;
			throw new Error(`Hook should not execute for path: ${path}`);
		},
		{ pattern: "**" }
	);

	// Access hooks API properties - should NOT trigger hooks
	const hooksObj = api.hooks;
	const onMethod = api.hooks.on;
	const offMethod = api.hooks.off;
	const enableMethod = api.hooks.enable;
	const disableMethod = api.hooks.disable;
	const clearMethod = api.hooks.clear;
	const listMethod = api.hooks.list;

	assert(typeof hooksObj === "object", "api.hooks should be an object");
	assert(typeof onMethod === "function", "api.hooks.on should be a function");
	assert(typeof offMethod === "function", "api.hooks.off should be a function");
	assert(typeof enableMethod === "function", "api.hooks.enable should be a function");
	assert(typeof disableMethod === "function", "api.hooks.disable should be a function");
	assert(typeof clearMethod === "function", "api.hooks.clear should be a function");
	assert(typeof listMethod === "function", "api.hooks.list should be a function");
	assert(!hookExecuted, "Hook should not have been executed for hooks API access");

	await api.shutdown();
});

await runTest("INTERNAL: Accessing api.__ctx doesn't trigger hooks", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let hookExecuted = false;

	api.hooks.on(
		"catch-all",
		"before",
		({ path }) => {
			hookExecuted = true;
			throw new Error(`Hook should not execute for path: ${path}`);
		},
		{ pattern: "**" }
	);

	// Access __ctx - should NOT trigger hooks
	const ctx = api.__ctx;

	assert(typeof ctx === "object", "api.__ctx should be an object");
	assert(!hookExecuted, "Hook should not have been executed for __ctx access");

	await api.shutdown();
});

await runTest("INTERNAL: Accessing api.shutdown doesn't trigger hooks", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let hookExecuted = false;

	api.hooks.on(
		"catch-all",
		"before",
		({ path }) => {
			hookExecuted = true;
			throw new Error(`Hook should not execute for path: ${path}`);
		},
		{ pattern: "**" }
	);

	// Access shutdown - should NOT trigger hooks
	const shutdownFn = api.shutdown;

	assert(typeof shutdownFn === "function", "api.shutdown should be a function");
	assert(!hookExecuted, "Hook should not have been executed for shutdown access");

	await api.shutdown();
});

await runTest("INTERNAL: Calling internal methods doesn't trigger hooks", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let hookExecuted = false;

	api.hooks.on(
		"catch-all",
		"before",
		({ path }) => {
			if (path !== "math.add") {
				hookExecuted = true;
				throw new Error(`Hook should not execute for internal path: ${path}`);
			}
		},
		{ pattern: "**" }
	);

	// Call hooks API methods - should NOT trigger hooks
	const hooks = api.hooks.list();
	assert(Array.isArray(hooks), "list() should return array");

	api.hooks.enable();
	api.hooks.disable();
	api.hooks.enable();

	// Register and remove a hook
	const id = api.hooks.on("test", "after", () => {}, { pattern: "math.*" });
	const removed = api.hooks.off(id);
	assert(removed === true, "off() should return true for removed hook");

	// Clear hooks by type
	api.hooks.clear("after");

	assert(!hookExecuted, "Hooks should not execute for internal API calls");

	await api.shutdown();
});

await runTest("INTERNAL: API function calls DO trigger hooks (sanity check)", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	let hookExecuted = false;
	let hookPath = null;

	api.hooks.on(
		"catch-all",
		"before",
		({ path }) => {
			hookExecuted = true;
			hookPath = path;
		},
		{ pattern: "**" }
	);

	// Call actual API function - SHOULD trigger hook
	await api.math.add(2, 3);

	assert(hookExecuted, "Hook should have been executed for API function");
	assert(hookPath === "math.add", `Hook path should be 'math.add', got '${hookPath}'`);

	await api.shutdown();
});

// ==================================================================
// PATTERN MATCHING: OFF AND CLEAR
// ==================================================================

await runTest("PATTERN: off() removes hooks by exact name", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on("test1", "before", () => {}, { pattern: "**" });
	api.hooks.on("test2", "before", () => {}, { pattern: "**" });

	let hooks = api.hooks.list();
	assert(hooks.length === 2, "Should have 2 hooks");

	const removed = api.hooks.off("test1");
	assert(removed === true, "off() should return true");

	hooks = api.hooks.list();
	assert(hooks.length === 1, "Should have 1 hook after removal");
	assert(hooks[0].name === "test2", "Remaining hook should be test2");

	await api.shutdown();
});

await runTest("PATTERN: off() removes multiple hooks by pattern", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on("math.validator1", "before", () => {}, { pattern: "**" });
	api.hooks.on("math.validator2", "before", () => {}, { pattern: "**" });
	api.hooks.on("other.hook", "before", () => {}, { pattern: "**" });

	let hooks = api.hooks.list();
	assert(hooks.length === 3, "Should have 3 hooks");

	const removed = api.hooks.off("math.*");
	assert(removed === true, "off() should return true for pattern removal");

	hooks = api.hooks.list();
	assert(hooks.length === 1, "Should have 1 hook after pattern removal");
	assert(hooks[0].name === "other.hook", "Remaining hook should be other.hook");

	await api.shutdown();
});

await runTest("PATTERN: clear() removes all hooks when no type specified", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on("test1", "before", () => {}, { pattern: "**" });
	api.hooks.on("test2", "after", () => {}, { pattern: "**" });
	api.hooks.on("test3", "always", () => {}, { pattern: "**" });

	let hooks = api.hooks.list();
	assert(hooks.length === 3, "Should have 3 hooks");

	api.hooks.clear();

	hooks = api.hooks.list();
	assert(hooks.length === 0, "Should have no hooks after clear()");

	await api.shutdown();
});

await runTest("PATTERN: clear(type) removes only hooks of specified type", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on("test1", "before", () => {}, { pattern: "**" });
	api.hooks.on("test2", "before", () => {}, { pattern: "**" });
	api.hooks.on("test3", "after", () => {}, { pattern: "**" });
	api.hooks.on("test4", "always", () => {}, { pattern: "**" });

	let hooks = api.hooks.list();
	assert(hooks.length === 4, "Should have 4 hooks");

	api.hooks.clear("before");

	hooks = api.hooks.list();
	assert(hooks.length === 2, "Should have 2 hooks after clearing before hooks");

	const types = hooks.map((h) => h.type);
	assert(!types.includes("before"), "Should not have any before hooks");
	assert(types.includes("after"), "Should still have after hook");
	assert(types.includes("always"), "Should still have always hook");

	await api.shutdown();
});

await runTest("PATTERN: list() returns all hooks when no type specified", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on("test1", "before", () => {}, { pattern: "**" });
	api.hooks.on("test2", "after", () => {}, { pattern: "**" });
	api.hooks.on("test3", "always", () => {}, { pattern: "**" });

	const hooks = api.hooks.list();
	assert(hooks.length === 3, "Should list all 3 hooks");

	await api.shutdown();
});

await runTest("PATTERN: list(type) returns only hooks of specified type", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		hooks: true
	});

	api.hooks.on("test1", "before", () => {}, { pattern: "**" });
	api.hooks.on("test2", "before", () => {}, { pattern: "**" });
	api.hooks.on("test3", "after", () => {}, { pattern: "**" });
	api.hooks.on("test4", "always", () => {}, { pattern: "**" });

	const beforeHooks = api.hooks.list("before");
	assert(beforeHooks.length === 2, "Should list 2 before hooks");
	assert(beforeHooks.every((h) => h.type === "before"), "All hooks should be before type");

	const afterHooks = api.hooks.list("after");
	assert(afterHooks.length === 1, "Should list 1 after hook");

	const alwaysHooks = api.hooks.list("always");
	assert(alwaysHooks.length === 1, "Should list 1 always hook");

	const errorHooks = api.hooks.list("error");
	assert(errorHooks.length === 0, "Should list 0 error hooks");

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
