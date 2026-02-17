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
 * Tests that API files can properly manage EventEmitter cleanup for third-party
 * libraries (like pg-pool) that they instantiate.
 *
 * Key principle: Slothlet should NOT clean up EventEmitters created outside of
 * slothlet API files. However, API files that create EventEmitters (e.g., by
 * instantiating pg-pool) are responsible for cleaning them up.
 *
 * This test verifies that API files can:
 * - Create third-party library instances with EventEmitters
 * - Track their own EventEmitter instances
 * - Clean them up when the API file provides a cleanup method
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

	test("API file can create and manage third-party EventEmitters", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.database.pool.init();
		}

		// Initialize the pool (creates EventEmitters within the API file)
		const initStats = await api.database.pool.init();

		expect(initStats.clientCount).toBe(5);
		expect(initStats.listenerCount).toBe(20); // 5 clients × 4 events

		// Get current stats
		const currentStats = await api.database.pool.getStats();
		expect(currentStats.clientCount).toBe(5);
		expect(currentStats.listenerCount).toBe(20);
		expect(currentStats.isShutdown).toBe(false);

		// API file should provide cleanup method
		const shutdownResult = await api.database.pool.shutdown();
		expect(shutdownResult.success).toBe(true);
		expect(shutdownResult.wasShutdown).toBe(true);

		// After API file cleanup, listeners should be gone
		const afterStats = await api.database.pool.getStats();
		expect(afterStats.listenerCount).toBe(0);
		expect(afterStats.isShutdown).toBe(null); // Pool instance was nulled

		// Slothlet shutdown should complete successfully
		await api.shutdown();
	});

	test("API file cleanup is independent of slothlet shutdown", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});

		// Materialize if lazy
		if (config.mode === "lazy") {
			await api.database.pool.init();
		}

		// Initialize pool
		await api.database.pool.init();

		const beforeShutdown = await api.database.pool.getStats();
		expect(beforeShutdown.listenerCount).toBe(20);

		// Shutdown slothlet WITHOUT calling pool.shutdown()
		await api.shutdown();

		// The pool's EventEmitters are NOT automatically cleaned up by slothlet
		// because they were created within the API file, not by slothlet itself.
		// This is correct behavior - API files manage their own resources.
		// (We can't check this after shutdown since the API is no longer accessible)
	});
});
