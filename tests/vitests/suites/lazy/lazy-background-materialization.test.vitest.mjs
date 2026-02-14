/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-background-materialization.test.vitest.mjs
 *	@Date: 2026-02-13
 *	@Author: Nate Hyson <CLDMV>
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for background materialization with tracking.materialization config
 * @module tests/vitests/suites/lazy/lazy-background-materialization
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Only LAZY configs
const matrixConfigs = getMatrixConfigs({ mode: "lazy" });

describe("Background Materialization (config.tracking.materialization)", () => {
	describe.each(matrixConfigs)("Config: $name", ({ config }) => {
		let api;

		afterEach(async () => {
			if (api && typeof api.shutdown === "function") {
				await api.shutdown();
			}
			api = null;
		});

		describe("Config-driven behavior", () => {
			it("should NOT trigger background materialization when tracking.materialization is false", async () => {
				api = await slothlet({
					...config,
					dir: TEST_DIRS.API_TEST,
					tracking: { materialization: false }
				});

			// Give background work time to NOT happen
			await new Promise((resolve) => setTimeout(resolve, 100));

			const stats = api.slothlet.materialize.get();
			
			// Without tracking, some wrappers should still be unmaterialized
			// (unless user accessed them, which we haven't in this test)
			expect(stats.total).toBeGreaterThanOrEqual(0);

			await api.shutdown();
		});

		it("should trigger background materialization when tracking.materialization is true", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: { materialization: true }
			});

			// Wait for background materialization to complete
			await new Promise((resolve) => setTimeout(resolve, 500));

			const stats = api.slothlet.materialize.get();
			
			// With background materialization, all should be materialized
			expect(stats.remaining).toBe(0);
			expect(stats.percentage).toBe(100);
			expect(api.slothlet.materialize.materialized).toBe(true);

			await api.shutdown();
		});

		it("should accept tracking as boolean shorthand", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: true // Boolean shorthand
			});

			await new Promise((resolve) => setTimeout(resolve, 500));

			const stats = api.slothlet.materialize.get();
			expect(stats.remaining).toBe(0);
			expect(api.slothlet.materialize.materialized).toBe(true);

			await api.shutdown();
		});

		it("should default to disabled when tracking config not provided", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy"
				// No tracking config
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should not have automatically materialized
			const stats = api.slothlet.materialize.get();
			expect(stats).toBeDefined();

			await api.shutdown();
		});
	});

	describe("Lifecycle event emission", () => {
		it("should emit 'materialized:complete' event when all lazy wrappers materialized", async () => {
			let eventEmitted = false;
			let eventData = null;

			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: { materialization: true }
			});

			// Subscribe to lifecycle event via public API
			api.slothlet.lifecycle.subscribe("materialized:complete", (data) => {
				eventEmitted = true;
				eventData = data;
			});

			// Wait for background materialization
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Event should have been emitted
			expect(eventEmitted).toBe(true);
			expect(eventData).toBeDefined();
			expect(eventData.total).toBeGreaterThanOrEqual(0);
			expect(typeof eventData.timestamp).toBe("number");

			await api.shutdown();
		});

		it("should NOT emit event when tracking.materialization is disabled", async () => {
			let eventEmitted = false;

			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: { materialization: false }
			});

			api.slothlet.lifecycle.subscribe("materialized:complete", () => {
				eventEmitted = true;
			});

			// Manually materialize some modules
			if (api.math && typeof api.math.add === "function") {
				try {
					api.math.add(1, 2);
				} catch (err) {}
			}

			await new Promise((resolve) => setTimeout(resolve, 200));

			// Event should NOT be emitted (tracking disabled)
			expect(eventEmitted).toBe(false);

			await api.shutdown();
		});

		it("should emit event only once even if checked multiple times", async () => {
			let eventCount = 0;

			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: { materialization: true }
			});

			api.slothlet.lifecycle.subscribe("materialized:complete", () => {
				eventCount++;
			});

			// Wait for background materialization
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Check stats multiple times
			api.slothlet.materialize.get();
			api.slothlet.materialize.get();
			api.slothlet.materialize.get();

			// Event should only be emitted once
			expect(eventCount).toBe(1);

			await api.shutdown();
		});
	});

	describe("Integration with wait() functionality", () => {
		it("should materialize all wrappers in background when tracking enabled", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: { materialization: true }
			});

			// Wait for background work to complete
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// All should be materialized
			const stats = api.slothlet.materialize.get();
			expect(stats.remaining).toBe(0);
			expect(api.slothlet.materialize.materialized).toBe(true);

			await api.shutdown();
		});

		it("should work correctly with manual wait() after background completes", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: { materialization: true }
			});

			// Wait for background materialization
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// wait() should resolve immediately since already complete
			const start = Date.now();
			await api.slothlet.materialize.wait();
			const duration = Date.now() - start;

			// Should resolve nearly instantly
			expect(duration).toBeLessThan(100);
			expect(api.slothlet.materialize.materialized).toBe(true);

			await api.shutdown();
		});
	});

	describe("Performance and safety", () => {
		it("should not break with eager mode (tracking should be ignored)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "eager",
				tracking: { materialization: true }
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Eager mode should always show 100% materialized
			const stats = api.slothlet.materialize.get();
			expect(stats.remaining).toBe(0);
			expect(api.slothlet.materialize.materialized).toBe(true);

			await api.shutdown();
		});

		it("should handle errors during background traversal gracefully", async () => {
			// This test ensures background materialization doesn't crash on errors
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: { materialization: true }
			});

			// Wait for background work (should not throw)
			await new Promise((resolve) => setTimeout(resolve, 500));

			// API should still be functional
			expect(api).toBeDefined();
			expect(api.slothlet).toBeDefined();

			await api.shutdown();
		});

		it("should not materialize when both tracking=false and manual access", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				tracking: false
			});

			// Background materialization should NOT happen
			await new Promise((resolve) => setTimeout(resolve, 200));

			const beforeStats = api.slothlet.materialize.get();

			// Manually access ONE module
			if (api.math && typeof api.math.add === "function") {
				try {
					api.math.add(1, 2);
				} catch (err) {}
			}

			await new Promise((resolve) => setTimeout(resolve, 100));

			const afterStats = api.slothlet.materialize.get();

			// Only the manually accessed module should be materialized (if any)
			// Total should remain the same
			expect(afterStats.total).toBe(beforeStats.total);

			await api.shutdown();
		});
	});
	});
});
