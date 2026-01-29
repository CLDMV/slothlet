/**
 * @fileoverview Test that AsyncLocalStorage is properly cleaned up on shutdown
 * @module tests/vitests/processed/context/als-cleanup.test.vitest
 *
 * @description
 * Tests that ALS runtime registry and instance data are properly cleaned up
 * when an instance is shut down, preventing memory leaks.
 */

import { describe, test, expect, beforeEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Only test async runtime since live-bindings doesn't use ALS
describe.each(getMatrixConfigs({ runtime: "async" }))("ALS Cleanup > Config: '$name'", ({ config }) => {
	let slothlet;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	test("should clear instance data and ALS registry after shutdown", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { test: "data" },
			diagnostics: true // Enable diagnostics for context testing
		});

		// V3: Use context.diagnostics() API
		const contextDiag = api.slothlet.context.diagnostics();
		expect(contextDiag).toBeDefined();
		expect(contextDiag.instanceID).toBeDefined();
		expect(contextDiag.baseContext).toBeDefined();
		expect(contextDiag.managerType).toBe("AsyncContextManager");

		const instanceId = api.slothlet.instanceID;

		// Verify instance is in the context manager's instances Map
		expect(contextDiag.instancesMapKeys).toContain(instanceId);
		const instanceBefore = contextDiag.instancesMapKeys.find((id) => id === instanceId);
		expect(instanceBefore).toBeDefined();

		// Shutdown
		await api.shutdown();

		// After shutdown, diagnostics should show instance removed
		// Note: We can't call api.slothlet.diag.context() after shutdown,
		// but we can verify the context manager directly via asyncContextManager
		const { asyncContextManager } = await import("@cldmv/slothlet/factories/context");
		const diagAfter = asyncContextManager.getDiagnostics();

		// Instance should be removed from context manager's instances Map
		expect(diagAfter.instances.find((i) => i.id === instanceId)).toBeUndefined();
	});

	test("should disable ALS after shutdown to prevent memory leaks", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			diagnostics: true
		});

		const instanceId = api.slothlet.instanceID;

		// Shutdown
		await api.shutdown();

		// After shutdown, verify instance is removed from context manager
		const { asyncContextManager } = await import("@cldmv/slothlet/factories/context");
		const diagAfter = asyncContextManager.getDiagnostics();

		// Instance should be removed
		expect(diagAfter.instances.find((i) => i.id === instanceId)).toBeUndefined();
	});

	test("should not leak ALS between sequential instances", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { instance: 1 },
			diagnostics: true
		});

		const diag1 = api1.slothlet.context.diagnostics();
		const instanceId1 = api1.slothlet.instanceID;

		await api1.shutdown();

		// Create second instance
		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { instance: 2 },
			diagnostics: true
		});

		const diag2 = api2.slothlet.context.diagnostics();
		const instanceId2 = api2.slothlet.instanceID;

		// Different instances should have different instance IDs
		expect(instanceId2).not.toBe(instanceId1);

		// Context data should be isolated
		expect(diag1.baseContext.instance).toBe(1);
		expect(diag2.baseContext.instance).toBe(2);

		await api2.shutdown();
	});

	test("should handle multiple shutdowns without errors", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			diagnostics: true
		});

		// First shutdown
		await api.shutdown();

		// Second shutdown should not throw
		await expect(api.shutdown()).resolves.not.toThrow();
	});

	test("should support reload after shutdown when hotReload is enabled", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hotReload: true,
			context: { test: "initial" },
			diagnostics: true
		});

		// Verify API works before shutdown
		// Note: math.mjs file collision test returns a+b+1000
		const result1 = await api.math.add(1, 2);
		expect(result1).toBe(1003);

		// Shutdown
		await api.shutdown();

		// Reload should work and recreate the API
		await api.slothlet.reload();

		// API should work again after reload
		// Note: math.mjs file collision test returns a+b+1000
		const result2 = await api.math.add(3, 4);
		expect(result2).toBe(1007);

		// Cleanup
		await api.shutdown();
	});

	test("should cleanup old ALS state on multiple reloads", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hotReload: true,
			diagnostics: true
		});

		// Track instance IDs across reloads
		const instanceIds = [api.slothlet.instanceID];

		// Perform multiple reloads
		for (let i = 0; i < 3; i++) {
			await api.slothlet.reload();
			instanceIds.push(api.slothlet.instanceID);
		}

		// All instance IDs should be different
		const uniqueIds = new Set(instanceIds);
		expect(uniqueIds.size).toBe(4);

		// Verify old instances were cleaned up (only current should exist)
		const { asyncContextManager } = await import("@cldmv/slothlet/factories/context");
		const diag = asyncContextManager.getDiagnostics();

		// Old instance IDs should not be in context manager
		for (let i = 0; i < instanceIds.length - 1; i++) {
			expect(diag.instances.find((inst) => inst.id === instanceIds[i])).toBeUndefined();
		}

		// Current instance should still exist
		expect(diag.instances.find((inst) => inst.id === api.slothlet.instanceID)).toBeDefined();

		// API should still work after multiple reloads
		// Note: math.mjs file collision test returns a+b+1000
		const result = await api.math.add(5, 10);
		expect(result).toBe(1015);

		// Cleanup
		await api.shutdown();
	});
});
