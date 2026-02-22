/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/public-lifecycle-api.test.vitest.mjs
 *	@Date: 2026-02-14T08:43:03-08:00 (1771087383)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 15:36:28 -08:00 (1771716988)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests that external code can subscribe to lifecycle events via public api.slothlet.lifecycle
 * @module tests/vitests/suites/lazy/public-lifecycle-api
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Only LAZY configs
const matrixConfigs = getMatrixConfigs({ mode: "lazy" });

describe("Public Lifecycle API (api.slothlet.lifecycle)", () => {
	describe.each(matrixConfigs)("Config: $name", ({ config }) => {
		let api;

		afterEach(async () => {
			if (api && typeof api.shutdown === "function") {
				await api.shutdown();
			}
			api = null;
		});

		it("should allow external code to subscribe to 'materialized:complete' event", async () => {
			let eventReceived = false;
			let eventData = null;

			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				tracking: { materialization: true }
			});

			// External code subscribing via public API
			api.slothlet.lifecycle.on("materialized:complete", (data) => {
				eventReceived = true;
				eventData = data;
			});

			// Wait for background materialization to complete
			await api.slothlet.materialize.wait();

			expect(eventReceived).toBe(true);
			expect(eventData).toBeDefined();
			expect(eventData.total).toBeGreaterThan(0);
			expect(eventData.timestamp).toBeDefined();
		});

		it("should expose lifecycle manager with standard EventEmitter methods", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST
			});

			// Verify public API structure (on/off only — emit/subscribe are internal)
			expect(api.slothlet.lifecycle).toBeDefined();
			expect(typeof api.slothlet.lifecycle.on).toBe("function");
			expect(typeof api.slothlet.lifecycle.off).toBe("function");
			expect(api.slothlet.lifecycle.emit).toBeUndefined();
			expect(api.slothlet.lifecycle.subscribe).toBeUndefined();
			expect(api.slothlet.lifecycle.unsubscribe).toBeUndefined();
		});

		it("should allow unsubscribing using standard off() method", async () => {
			let callCount = 0;

			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				tracking: { materialization: true }
			});

			const callback = () => {
				callCount++;
			};

			// Subscribe using on()
			api.slothlet.lifecycle.on("materialized:complete", callback);

			// Unsubscribe using off()
			api.slothlet.lifecycle.off("materialized:complete", callback);

			// Wait for background materialization
			await api.slothlet.materialize.wait();

			// Callback should not have been called
			expect(callCount).toBe(0);
		});

		it("should work without internal __slothletInstance accessor", async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				tracking: { materialization: true }
			});

			// This is how external code should subscribe (no internal access)
			let publicAPIWorks = false;
			api.slothlet.lifecycle.on("materialized:complete", () => {
				publicAPIWorks = true;
			});

			await api.slothlet.materialize.wait();

			expect(publicAPIWorks).toBe(true);
		});
	});
});
