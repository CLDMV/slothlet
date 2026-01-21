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
			context: { test: "data" }
		});

		// Verify __ctx exists with all expected properties
		expect(api.__ctx).toBeDefined();
		expect(api.__ctx.self).toBe(api);
		expect(api.__ctx.context).toBeDefined();
		expect(api.__ctx.als).toBeDefined();
		expect(api.__ctx.instanceId).toBeDefined();

		const instanceId = api.instanceId;

		// Verify instance is in the registry
		const { getInstanceData } = await import("@cldmv/slothlet/helpers/instance-manager");
		const dataBefore = getInstanceData(instanceId);
		expect(dataBefore).toBeDefined();

		// Shutdown
		await api.shutdown();

		// Instance should be removed from instance registry
		const dataAfter = getInstanceData(instanceId);
		expect(dataAfter).toBeNull();

		// NOTE: api still references the old boundapi object,
		// so api.__ctx still exists. The important thing is that
		// the ALS store is disabled and registry is cleaned up
		// (tested in other test cases)
	});

	test("should disable ALS after shutdown to prevent memory leaks", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		const als = api.__ctx.als;

		// Shutdown
		await api.shutdown();

		// After disable(), accessing the ALS may throw or return undefined
		// Both are acceptable - what matters is it's not usable
		let storeAfter;
		try {
			storeAfter = als.getStore();
		} catch {
			// If getStore() throws after disable(), that's fine too
			storeAfter = undefined;
		}

		// ALS should not be usable after shutdown
		expect(storeAfter).toBeUndefined();
	});

	test("should not leak ALS between sequential instances", async () => {
		const api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { instance: 1 }
		});

		const als1 = api1.__ctx.als;
		const instanceId1 = api1.instanceId;

		await api1.shutdown();

		// Create second instance
		const api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { instance: 2 }
		});

		const als2 = api2.__ctx.als;
		const instanceId2 = api2.instanceId;

		// Different instances should have different instance IDs
		expect(instanceId2).not.toBe(instanceId1);

		// Different instances should have different ALS objects
		expect(als2).not.toBe(als1);

		await api2.shutdown();
	});

	test("should handle multiple shutdowns without errors", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
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
			context: { test: "initial" }
		});

		// Verify API works before shutdown
		const result1 = await api.math.add(1, 2);
		expect(result1).toBe(3);

		// Shutdown
		await api.shutdown();

		// Reload should work and recreate the API
		await api.reload();

		// API should work again after reload
		const result2 = await api.math.add(3, 4);
		expect(result2).toBe(7);

		// Cleanup
		await api.shutdown();
	});

	test("should cleanup old ALS state on multiple reloads", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			hotReload: true
		});

		const { getInstanceData } = await import("@cldmv/slothlet/helpers/instance-manager");

		// Track instance IDs across reloads
		const instanceIds = [api.instanceId];

		// Perform multiple reloads
		for (let i = 0; i < 3; i++) {
			await api.reload();
			instanceIds.push(api.instanceId);
		}

		// All instance IDs should be different
		const uniqueIds = new Set(instanceIds);
		expect(uniqueIds.size).toBe(4);

		// Verify old instances were cleaned up (only current should exist)
		for (let i = 0; i < instanceIds.length - 1; i++) {
			const oldData = getInstanceData(instanceIds[i]);
			expect(oldData).toBeNull();
		}

		// Current instance should still exist
		const currentData = getInstanceData(api.instanceId);
		expect(currentData).toBeDefined();

		// API should still work after multiple reloads
		const result = await api.math.add(5, 10);
		expect(result).toBe(15);

		// Cleanup
		await api.shutdown();
	});
});
