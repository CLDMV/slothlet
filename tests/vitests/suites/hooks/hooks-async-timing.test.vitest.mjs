/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-async-timing.test.vitest.mjs
 *	@Date: 2026-01-30T11:45:13-08:00 (1769802313)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:54 -08:00 (1770266394)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Vitest tests for always hooks timing with async functions.
 * @module tests/vitests/suites/hooks/hooks-async-timing.test.vitest
 *
 * @description
 * Verifies that always hooks fire AFTER async promise chains complete,
 * not immediately in the finally block. Tests use synchronous checks
 * before awaiting to verify hooks don't fire in the finally block.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Test each configuration in the matrix
describe.each(getMatrixConfigs({ hook: { enabled: true } }))("Hooks Async Timing > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		// Dynamic import of published entrypoint to mirror consumer usage
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;

		// Create API instance with the test config
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			collision: { initial: "replace", api: "replace" }
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		slothlet = null;
	});

	test("should NOT fire always hook in finally block - only in async chain", async () => {
		let alwaysHookFired = false;

		api.slothlet.hook.on(
			"always:task.autoIP",
			() => {
				alwaysHookFired = true;
			},
			{ id: "observe-timing" }
		);

		// Call async function - returns promise immediately
		const promise = api.task.autoIP();

		// CRITICAL: Check synchronously (no await yet!)
		// If finally block fired hooks, this would be true
		// If hooks fire in async chain, this should be false
		expect(alwaysHookFired).toBe(false);

		// Now await - hooks should fire in the .then handler
		const result = await promise;

		expect(result).toBe("testAutoIP");
		expect(alwaysHookFired).toBe(true);
	});

	test("should fire always hooks for multiple async calls correctly", async () => {
		let callCount = 0;

		api.slothlet.hook.on(
			"always:task.autoIP",
			() => {
				callCount++;
			},
			{ id: "count-calls" }
		);

		// Fire multiple async calls
		const p1 = api.task.autoIP();
		const p2 = api.task.autoIP();
		const p3 = api.task.autoIP();

		// Check synchronously - no hooks fired yet
		expect(callCount).toBe(0);

		// Await all
		const results = await Promise.all([p1, p2, p3]);

		expect(results).toEqual(["testAutoIP", "testAutoIP", "testAutoIP"]);
		expect(callCount).toBe(3);
	});
});
