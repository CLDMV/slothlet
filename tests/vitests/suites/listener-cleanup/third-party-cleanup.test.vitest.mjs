/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/listener-cleanup/third-party-cleanup.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:57 -08:00 (1770266397)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test cleanup of EventEmitters created within slothlet API files.
 * @module third-party-cleanup.test.vitest
 *
 * @description
 * Tests that EventEmitters created within slothlet API files are properly
 * tracked and cleaned up when slothlet shuts down. This includes:
 * - Native Node.js EventEmitters
 * - Third-party file watchers (chokidar)
 *
 * Key principle: Slothlet tracks and cleans up EventEmitters created WITHIN
 * slothlet API context, regardless of whether they're native or from third-party
 * libraries. EventEmitters created OUTSIDE slothlet context are NOT cleaned up.
 */

import { describe, test, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs({}))("Third-Party Listener Cleanup - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	test("Native EventEmitters created in API files are tracked and cleaned up", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.database.pool.createConnections();
		}

		// Create EventEmitters within API context
		const createResult = await api.database.pool.createConnections(5);
		expect(createResult.count).toBe(5);
		expect(createResult.totalListeners).toBe(20); // 5 emitters × 4 events

		// Verify listeners exist
		const beforeStats = await api.database.pool.getStats();
		expect(beforeStats.emitterCount).toBe(5);
		expect(beforeStats.totalListeners).toBe(20);

		// Get emitters for direct verification
		const emitters = await api.database.pool.getEmitters();
		expect(emitters).toHaveLength(5);

		const totalListenersBefore = emitters.reduce(
			(sum, e) =>
				sum +
				e.listenerCount("connect") +
				e.listenerCount("query") +
				e.listenerCount("error") +
				e.listenerCount("disconnect"),
			0
		);
		expect(totalListenersBefore).toBe(20);

		// Shutdown slothlet - should clean up tracked EventEmitters
		await api.shutdown();

		// Verify all listeners were removed
		const totalListenersAfter = emitters.reduce(
			(sum, e) =>
				sum +
				e.listenerCount("connect") +
				e.listenerCount("query") +
				e.listenerCount("error") +
				e.listenerCount("disconnect"),
			0
		);
		expect(totalListenersAfter).toBe(0);
	});

	test("Third-party EventEmitters (chokidar) created in API files are tracked and cleaned up", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.events.watcher.init();
		}

		// Initialize file watcher (creates EventEmitter within API context)
		const initResult = await api.events.watcher.init();
		expect(initResult.created).toBe(true);
		expect(initResult.listenerCount).toBe(5); // 5 event types

		// Verify listeners exist
		const listenersBefore = await api.events.watcher.getListenerCount();
		expect(listenersBefore).toBe(5);

		// Get instance for direct verification
		const watcher = await api.events.watcher.getInstance();
		expect(watcher).toBeTruthy();

		const directCountBefore =
			watcher.listenerCount("add") +
			watcher.listenerCount("change") +
			watcher.listenerCount("unlink") +
			watcher.listenerCount("error") +
			watcher.listenerCount("ready");
		expect(directCountBefore).toBe(5);

		// Shutdown slothlet - should clean up tracked EventEmitters
		await api.shutdown();

		// Verify all listeners were removed
		const directCountAfter =
			watcher.listenerCount("add") +
			watcher.listenerCount("change") +
			watcher.listenerCount("unlink") +
			watcher.listenerCount("error") +
			watcher.listenerCount("ready");
		expect(directCountAfter).toBe(0);
	});

	test("Both native and third-party EventEmitters are cleaned up simultaneously", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Materialize all if lazy
		if (config.mode === "lazy") {
			await api.database.pool.createConnections();
			await api.events.watcher.init();
		}

		// Create both types of EventEmitters
		await api.database.pool.createConnections(3);
		await api.events.watcher.init();

		// Get instances for verification
		const poolEmitters = await api.database.pool.getEmitters();
		const watcher = await api.events.watcher.getInstance();

		// Count listeners before shutdown
		const poolBefore = poolEmitters.reduce(
			(sum, e) =>
				sum +
				e.listenerCount("connect") +
				e.listenerCount("query") +
				e.listenerCount("error") +
				e.listenerCount("disconnect"),
			0
		);
		const watcherBefore =
			watcher.listenerCount("add") +
			watcher.listenerCount("change") +
			watcher.listenerCount("unlink") +
			watcher.listenerCount("error") +
			watcher.listenerCount("ready");

		expect(poolBefore).toBe(12); // 3 emitters × 4 events
		expect(watcherBefore).toBe(5);

		// Shutdown slothlet - should clean up ALL tracked EventEmitters
		await api.shutdown();

		// Verify all listeners were removed from both types
		const poolAfter = poolEmitters.reduce(
			(sum, e) =>
				sum +
				e.listenerCount("connect") +
				e.listenerCount("query") +
				e.listenerCount("error") +
				e.listenerCount("disconnect"),
			0
		);
		const watcherAfter =
			watcher.listenerCount("add") +
			watcher.listenerCount("change") +
			watcher.listenerCount("unlink") +
			watcher.listenerCount("error") +
			watcher.listenerCount("ready");

		expect(poolAfter).toBe(0);
		expect(watcherAfter).toBe(0);
	});
});
