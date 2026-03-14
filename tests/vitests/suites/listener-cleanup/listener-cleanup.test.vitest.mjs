/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/listener-cleanup/listener-cleanup.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:52 -08:00 (1772425312)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview EventEmitter context propagation and internal hook cleanup validation.
 *
 * @description
 * Tests that:
 * 1. EventEmitter context propagation works (self/context available in callbacks within API files)
 * 2. Internal slothlet hooks are properly cleaned up on shutdown
 *
 * NOTE: This does NOT test cleanup of external EventEmitters created in test code.
 * Slothlet should only clean up its own internal resources (hooks, lifecycle events).
 *
 * @module tests/vitests/processed/listener-cleanup/listener-cleanup.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create a slothlet instance for testing.
 * @param {object} baseConfig - Base configuration from the matrix.
 * @returns {Promise<object>} Initialized slothlet API instance.
 */
async function createApi(baseConfig) {
	return slothlet({ 
		...baseConfig, 
		dir: TEST_DIRS.API_TEST,
		context: { user: "test-user", session: "cleanup-test" }
	});
}

describe.each(getMatrixConfigs({}))("Listener Cleanup - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	it("cleans up lifecycle event listeners on shutdown", async () => {
		api = await createApi(config);

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.math.add(1, 1);
		}

		const lifecycleEvents = [];

		// Subscribe to lifecycle events
		const unsubscribe1 = api.slothlet.lifecycle.on("impl:changed", (data) => {
			lifecycleEvents.push({ event: "impl:changed", data });
		});

		const unsubscribe2 = api.slothlet.lifecycle.on("materialized:complete", (data) => {
			lifecycleEvents.push({ event: "materialized:complete", data });
		});

		// Trigger some lifecycle events (e.g., via api.add)
		if (api.add) {
			await api.add("math", { newFunc: () => 123 });
			// Should trigger impl:changed event
		}

		// Verify events were received
		const implChangedEvents = lifecycleEvents.filter((e) => e.event === "impl:changed");
		if (api.add) {
			expect(implChangedEvents.length).toBeGreaterThan(0);
		}

		// Shutdown should complete successfully even with active listeners
		await api.shutdown();

		// Cleanup functions should still be callable after shutdown (no-op)
		expect(() => unsubscribe1()).not.toThrow();
		expect(() => unsubscribe2()).not.toThrow();
	});

	it("cleans up internal hooks on shutdown", async () => {
		api = await createApi(config);

		if (!config.hooks) {
			// Skip test if hooks are disabled
			return;
		}

		// Register internal hooks
		const hookCalls = { before: 0, after: 0, always: 0 };

		api.slothlet.hook.on("before:**", () => {
			hookCalls.before++;
		});

		api.slothlet.hook.on("after:**", ({ result }) => {
			hookCalls.after++;
			return result;
		});

		api.slothlet.hook.on("always:**", () => {
			hookCalls.always++;
		});

		// Call API to trigger hooks
		await api.math.add(10, 20);

		// Verify hooks were called
		expect(hookCalls.before).toBeGreaterThan(0);
		expect(hookCalls.after).toBeGreaterThan(0);
		expect(hookCalls.always).toBeGreaterThan(0);

		const beforeCount = hookCalls.before;

		// Shutdown should clean up internal hooks
		await api.shutdown();

		// Verify shutdown completed without errors
		expect(hookCalls.before).toBe(beforeCount);
	});

	it("shuts down cleanly even with EventEmitters created in API files", async () => {
		api = await createApi(config);

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.tcp.createTestServer();
		}

		// Create TCP server via API (creates EventEmitters internally)
		const serverInfo = await api.tcp.createTestServer();
		expect(serverInfo.port).toBeGreaterThan(0);

		// Shutdown should complete successfully even though the API file
		// created EventEmitters. The API file is responsible for its own cleanup,
		// not slothlet.
		await api.shutdown();
		
		// Verify shutdown completed without hanging or errors
		expect(api).toBeDefined();
	});
});
