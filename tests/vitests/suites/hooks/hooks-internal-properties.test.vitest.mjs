/**
 * @fileoverview Tests to verify that internal properties like api.slothlet.hook don't trigger hook execution.
 *
 * Original test: tests/test-hooks-internal-properties.mjs
 * Original test count: 7 scenarios
 * New test count: 7 scenarios × 4 hook configs = 28 tests
 *
 * @module tests/vitests/processed/hooks/hooks-internal-properties.test.vitest
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Test each configuration in the matrix - only hooks-enabled configs
describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hooks Internal Properties > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		// Create API instance with hooks enabled and the test config
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			collision: { initial: "replace", api: "replace" } // Use folder version, ignore file collisions
		});
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	it("should not trigger hooks when accessing api.slothlet.hook", () => {
		let hookExecuted = false;

		// Register a hook that matches everything
		api.slothlet.hook.on(
			"before:**",
			({ path }) => {
				hookExecuted = true;
				throw new Error(`Hook should not execute for path: ${path}`);
			},
			{ id: "catch-all" }
		);

		// Access hooks API properties - should NOT trigger hooks
		const hooksObj = api.slothlet.hook;
		const onMethod = api.slothlet.hook.on;
		const offMethod = api.slothlet.hook.off;
		const enableMethod = api.slothlet.hook.enable;
		const disableMethod = api.slothlet.hook.disable;
		const clearMethod = api.slothlet.hook.clear;
		const listMethod = api.slothlet.hook.list;

		expect(typeof hooksObj).toBe("object");
		expect(typeof onMethod).toBe("function");
		expect(typeof offMethod).toBe("function");
		expect(typeof enableMethod).toBe("function");
		expect(typeof disableMethod).toBe("function");
		expect(typeof clearMethod).toBe("function");
		expect(typeof listMethod).toBe("function");
		expect(hookExecuted).toBe(false);
	});

	it("should not trigger hooks when accessing api.slothlet namespace", () => {
		let hookExecuted = false;

		api.slothlet.hook.on(
			"before:**",
			({ path }) => {
				hookExecuted = true;
				throw new Error(`Hook should not execute for path: ${path}`);
			},
			{ id: "catch-all" }
		);

		// Access slothlet namespace - should NOT trigger hooks
		const slothletNs = api.slothlet;

		expect(typeof slothletNs).toBe("object");
		expect(hookExecuted).toBe(false);
	});

	it("should not trigger hooks when accessing api.shutdown", () => {
		let hookExecuted = false;

		api.slothlet.hook.on(
			"before:**",
			({ path }) => {
				hookExecuted = true;
				throw new Error(`Hook should not execute for path: ${path}`);
			},
			{ id: "catch-all" }
		);

		// Access shutdown method - should NOT trigger hooks
		const shutdownMethod = api.shutdown;

		expect(typeof shutdownMethod).toBe("function");
		expect(hookExecuted).toBe(false);
	});

	it("should not trigger hooks when accessing api._impl", () => {
		let hookExecuted = false;

		api.slothlet.hook.on(
			"before:**",
			({ path }) => {
				hookExecuted = true;
				throw new Error(`Hook should not execute for path: ${path}`);
			},
			{ id: "catch-all" }
		);

		// Access _impl if it exists - should NOT trigger hooks
		const _ = api._impl;

		// _impl might not exist in all configurations, but accessing it shouldn't trigger hooks
		expect(hookExecuted).toBe(false);
	});

	it("should not trigger hooks when calling api.slothlet.hook methods", () => {
		let hookExecuted = false;
		let methodCallsExecuted = 0;

		// Create a hook that should only execute for actual function calls
		api.slothlet.hook.on(
			"before:**",
			({ path }) => {
				if (path.startsWith("hooks.")) {
					hookExecuted = true;
					throw new Error(`Hook should not execute for hooks API call: ${path}`);
				}
				methodCallsExecuted++;
			},
			{ id: "test-hook" }
		);

		// Call hooks methods - should NOT trigger the catch-all hook
		const hooksList = api.slothlet.hook.list();
		api.slothlet.hook.enable();
		api.slothlet.hook.disable();
		api.slothlet.hook.enable(); // Re-enable for potential other tests

		expect(typeof hooksList).toBeDefined();
		expect(hookExecuted).toBe(false);
		expect(methodCallsExecuted).toBe(0); // No actual API function calls yet
	});

	it("should only trigger hooks for actual API function calls", async () => {
		let hooksTriggeredPaths = [];

		api.slothlet.hook.on(
			"before:**",
			({ path }) => {
				console.log(`[DEBUG] Hook triggered for path: ${path}`);
				hooksTriggeredPaths.push(path);
			},
			{ id: "path-tracker" }
		);

		// Access internal properties (should not trigger hooks)
		const ___unused1 = api.slothlet.hook;
		const ___unused2 = api.slothlet;
		const ___unused3 = api.shutdown;

		console.log(`[DEBUG] About to call api.math.add(2, 3)`);
		console.log(`[DEBUG] Hooks enabled: ${api.slothlet.diag?.hook?.enabled}`);
		console.log(`[DEBUG] api.math type: ${typeof api.math}`);

		// Now call an actual API function
		await api.math.add(2, 3);

		console.log(`[DEBUG] Hooks triggered:`, hooksTriggeredPaths);

		// Only the actual function call should trigger hooks
		expect(hooksTriggeredPaths).toHaveLength(1);
		expect(hooksTriggeredPaths[0]).toMatch(/math\.add/);
	});

	it("should preserve hook functionality after accessing internal properties", async () => {
		let hookCalls = [];

		// Access all internal properties first
		const ___unused1 = api.slothlet.hook;
		const ___unused2 = api.slothlet;
		const ___unused3 = api.shutdown;
		const ___unused4 = api._impl;

		// Now register hook after accessing properties
		api.slothlet.hook.on(
			"before:math.add",
			({ path, args }) => {
				console.log(`[DEBUG] Hook triggered for ${path} with args:`, args);
				hookCalls.push({ path, args });
			},
			{ id: "track-add" }
		);

		console.log(`[DEBUG] About to call api.math.add(5, 7)`);
		console.log(`[DEBUG] Hooks enabled: ${api.slothlet.diag?.hook?.enabled}`);

		// Call API function
		const result = await api.math.add(5, 7);

		console.log(`[DEBUG] Result: ${result}, hookCalls:`, hookCalls);

		expect(result).toBe(12);
		expect(hookCalls).toHaveLength(1);
		expect(hookCalls[0].path).toMatch(/math\.add/);
		expect(hookCalls[0].args).toEqual([5, 7]);
	});
});
