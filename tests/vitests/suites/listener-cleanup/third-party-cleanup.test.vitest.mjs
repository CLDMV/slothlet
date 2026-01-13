/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/processed/listener-cleanup/third-party-cleanup.test.vitest.mjs
 *	@Date: 2026-01-17 07:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-12 15:54:02 -08:00 (1768262042)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Vitest tests for third-party library listener cleanup.
 * @module third-party-cleanup.test.vitest
 *
 * @description
 * Tests that slothlet properly cleans up EventEmitter listeners from third-party
 * libraries (like pg-pool) that are created after slothlet loads and patches
 * EventEmitter.prototype globally.
 *
 * Key scenarios:
 * - Pre-slothlet EventEmitters should NOT be cleaned up (not tracked)
 * - Post-slothlet EventEmitters SHOULD be cleaned up (tracked)
 * - EventEmitters created during API usage should be cleaned up
 */

import { describe, test, expect } from "vitest";
import slothlet from "../../../../index.mjs";
import { EventEmitter } from "node:events";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Simulate pg-pool-like behavior - library creates EventEmitters and listeners
 */
function createPgPoolSimulation() {
	const clients = [];

	for (let i = 0; i < 5; i++) {
		const client = new EventEmitter();

		client.once("error", () => {});
		client.on("response", () => {});
		client.on("connect", () => {});
		client.on("end", () => {});

		clients.push(client);
	}

	return clients;
}

describe.each(getMatrixConfigs({}))("Third-Party Listener Cleanup - $name", ({ config }) => {
	test("Pre-slothlet EventEmitters not cleaned up", async () => {
		// Create EventEmitters BEFORE slothlet loads
		const preSlothletEmitters = createPgPoolSimulation();

		const preListenerCount = preSlothletEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);

		expect(preListenerCount).toBe(20); // 5 clients × 4 events

		// Now load slothlet
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Shutdown slothlet
		await api.shutdown();

		// Pre-slothlet listeners should still exist
		const preRemaining = preSlothletEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);

		expect(preRemaining).toBe(preListenerCount);
	});

	test("Post-slothlet EventEmitters cleaned up", async () => {
		// Load slothlet first
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Create EventEmitters AFTER slothlet loads
		const postSlothletEmitters = createPgPoolSimulation();

		const postListenerCount = postSlothletEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);

		expect(postListenerCount).toBe(20); // 5 clients × 4 events

		// Shutdown slothlet
		await api.shutdown();

		// Post-slothlet listeners should be cleaned up
		const postRemaining = postSlothletEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);

		expect(postRemaining).toBe(0);
	});

	test("EventEmitters during API usage cleaned up", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Create EventEmitters during API usage
		const duringApiEmitters = [];
		for (let i = 0; i < 3; i++) {
			const emitter = new EventEmitter();
			emitter.on("api-event", () => {});
			duringApiEmitters.push(emitter);
		}

		const duringCount = duringApiEmitters.reduce((sum, e) => sum + e.listenerCount("api-event"), 0);

		expect(duringCount).toBe(3);

		// Shutdown
		await api.shutdown();

		// Should be cleaned up
		const duringRemaining = duringApiEmitters.reduce((sum, e) => sum + e.listenerCount("api-event"), 0);

		expect(duringRemaining).toBe(0);
	});

	test("Mixed scenario: pre/post/during cleanup", async () => {
		// Pre-slothlet
		const preEmitters = createPgPoolSimulation();
		const preCount = preEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);

		// Load slothlet
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Post-slothlet
		const postEmitters = createPgPoolSimulation();
		const postCount = postEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);

		// During API
		const duringEmitters = [];
		for (let i = 0; i < 3; i++) {
			const emitter = new EventEmitter();
			emitter.on("api-event", () => {});
			duringEmitters.push(emitter);
		}
		const duringCount = duringEmitters.reduce((sum, e) => sum + e.listenerCount("api-event"), 0);

		const totalBefore = preCount + postCount + duringCount;
		expect(totalBefore).toBe(43); // 20 + 20 + 3

		// Shutdown
		await api.shutdown();

		// Check what remains
		const preRemaining = preEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);
		const postRemaining = postEmitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);
		const duringRemaining = duringEmitters.reduce((sum, e) => sum + e.listenerCount("api-event"), 0);

		// Pre-slothlet preserved, post/during cleaned up
		expect(preRemaining).toBe(preCount);
		expect(postRemaining).toBe(0);
		expect(duringRemaining).toBe(0);
	});

	test("API functionality works with third-party listeners", async () => {
		const api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Create third-party listeners
		const emitters = createPgPoolSimulation();

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.math.add(1, 1);
		}

		// API should still work
		const result = await api.math.add(100, 200);
		expect(result).toBe(300);

		// Cleanup
		await api.shutdown();

		// Third-party listeners cleaned
		const remaining = emitters.reduce(
			(sum, e) => sum + e.listenerCount("error") + e.listenerCount("response") + e.listenerCount("connect") + e.listenerCount("end"),
			0
		);
		expect(remaining).toBe(0);
	});
});
