/**
 * @fileoverview Tests to verify that internal properties like api.hooks don't trigger hook execution.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "./vitest-helper.mjs";

// Test each configuration in the matrix
describe.each(getMatrixConfigs())("Hooks Internal Properties > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		// Create API instance with hooks enabled and the test config
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hooks: true
		});
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	test("should not trigger hooks when accessing api.hooks", () => {
		let hookExecuted = false;

		// Register a hook that matches everything
		api.hooks.on(
			"before",
			({ path }) => {
				hookExecuted = true;
				throw new Error(`Hook should not execute for path: ${path}`);
			},
			{ id: "catch-all", pattern: "**" }
		);

		// Access hooks API properties - should NOT trigger hooks
		const hooksObj = api.hooks;
		const onMethod = api.hooks.on;
		const offMethod = api.hooks.off;
		const enableMethod = api.hooks.enable;
		const disableMethod = api.hooks.disable;
		const clearMethod = api.hooks.clear;
		const listMethod = api.hooks.list;

		expect(typeof hooksObj).toBe("object");
		expect(typeof onMethod).toBe("function");
		expect(typeof offMethod).toBe("function");
		expect(typeof enableMethod).toBe("function");
		expect(typeof disableMethod).toBe("function");
		expect(typeof clearMethod).toBe("function");
		expect(typeof listMethod).toBe("function");
		expect(hookExecuted).toBe(false);
	});

	test("should not trigger hooks when accessing api.__ctx", () => {
		let hookExecuted = false;

		api.hooks.on(
			"before",
			({ path }) => {
				hookExecuted = true;
				throw new Error(`Hook should not execute for path: ${path}`);
			},
			{ id: "catch-all", pattern: "**" }
		);

		// Access __ctx - should NOT trigger hooks
		const ctx = api.__ctx;

		expect(typeof ctx).toBe("object");
		expect(hookExecuted).toBe(false);
	});

	test("should not trigger hooks when accessing api.shutdown", () => {
		let hookExecuted = false;

		api.hooks.on(
			"before",
			({ path }) => {
				hookExecuted = true;
				throw new Error(`Hook should not execute for path: ${path}`);
			},
			{ id: "catch-all", pattern: "**" }
		);

		// Access shutdown method - should NOT trigger hooks
		const shutdownMethod = api.shutdown;

		expect(typeof shutdownMethod).toBe("function");
		expect(hookExecuted).toBe(false);
	});

	test("should not trigger hooks when accessing api._impl", () => {
		let hookExecuted = false;

		api.hooks.on(
			"before",
			({ path }) => {
				hookExecuted = true;
				throw new Error(`Hook should not execute for path: ${path}`);
			},
			{ id: "catch-all", pattern: "**" }
		);

		// Access _impl if it exists - should NOT trigger hooks
		const _ = api._impl;

		// _impl might not exist in all configurations, but accessing it shouldn't trigger hooks
		expect(hookExecuted).toBe(false);
	});

	test("should not trigger hooks when calling api.hooks methods", () => {
		let hookExecuted = false;
		let methodCallsExecuted = 0;

		// Create a hook that should only execute for actual function calls
		api.hooks.on(
			"before",
			({ path }) => {
				if (path.startsWith("hooks.")) {
					hookExecuted = true;
					throw new Error(`Hook should not execute for hooks API call: ${path}`);
				}
				methodCallsExecuted++;
			},
			{ id: "test-hook", pattern: "**" }
		);

		// Call hooks methods - should NOT trigger the catch-all hook
		const hooksList = api.hooks.list();
		api.hooks.enable();
		api.hooks.disable();
		api.hooks.enable(); // Re-enable for potential other tests

		expect(typeof hooksList).toBeDefined();
		expect(hookExecuted).toBe(false);
		expect(methodCallsExecuted).toBe(0); // No actual API function calls yet
	});

	test("should only trigger hooks for actual API function calls", async () => {
		let hooksTriggeredPaths = [];

		api.hooks.on(
			"before",
			({ path }) => {
				hooksTriggeredPaths.push(path);
			},
			{ id: "path-tracker", pattern: "**" }
		);

		// Access internal properties (should not trigger hooks)
		const ___unused1 = api.hooks;
		const ___unused2 = api.__ctx;
		const ___unused3 = api.shutdown;

		// Now call an actual API function
		await api.math.add(2, 3);

		// Only the actual function call should trigger hooks
		expect(hooksTriggeredPaths).toHaveLength(1);
		expect(hooksTriggeredPaths[0]).toMatch(/math\.add/);
	});

	test("should preserve hook functionality after accessing internal properties", async () => {
		let hookCalls = [];

		// Access all internal properties first
		const ___unused1 = api.hooks;
		const ___unused2 = api.__ctx;
		const ___unused3 = api.shutdown;

		// Now register a hook
		api.hooks.on(
			"before",
			({ path, args }) => {
				hookCalls.push({ path: path, args: args });
			},
			{ id: "test-hook", pattern: "math.*" }
		);

		// Call a function - hook should still work
		const result = await api.math.add(5, 7);

		expect(result).toBe(12);
		expect(hookCalls).toHaveLength(1);
		expect(hookCalls[0].path).toMatch(/math\.add/);
		expect(hookCalls[0].args).toEqual([5, 7]);
	});
});
