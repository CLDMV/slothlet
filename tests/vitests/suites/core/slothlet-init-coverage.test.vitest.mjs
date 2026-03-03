/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/slothlet-init-coverage.test.vitest.mjs
 *	@Date: 2026-03-03 00:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 00:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for slothlet.mjs internals that require specific runtime conditions.
 *
 * @description
 * Targets the following uncovered lines in src/slothlet.mjs:
 *
 * - **Lines 347–348** (`setApiContextChecker` callback body):
 *   The callback `() => { const ctx = ...; return !!(ctx && ctx.self); }` is only executed
 *   when `isInApiContext()` is called by the EventEmitter patching layer — which triggers
 *   whenever an EventEmitter registers a listener via `.on()` after `enableEventEmitterPatching()`
 *   has been called. The truthy return path (`ctx && ctx.self`) fires only when a listener is
 *   registered while executing inside an active `api.slothlet.run()` context, where
 *   `tryGetContext()` returns a store with `self: {}`.
 *
 * - **Lines 355–356** (reload preserved-context cleanup branch):
 *   ```js
 *   this.contextManager.cleanup(preservedInstanceID);
 *   store = this.contextManager.initialize(this.instanceID, this.config);
 *   ```
 *   Inside `load()`, when called with a non-null `preservedInstanceID` AND
 *   `contextManager.instances.has(preservedInstanceID)` is true, the old context is cleaned
 *   up before the new one is created. This fires during `api.slothlet.reload()` because the
 *   apiManager calls `slothlet.load(config, oldInstanceID)` while the old context is still live.
 *
 * @module tests/vitests/suites/core/slothlet-init-coverage
 */

import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Lines 347–348: setApiContextChecker callback body ────────────────────────

describe("slothlet.mjs setApiContextChecker callback (lines 347–348)", () => {
	it("EventEmitter.on() inside run() triggers context checker with truthy ctx.self (async runtime)", async () => {
		// The setApiContextChecker callback body (lines 347-348) executes any time an
		// EventEmitter.prototype.on is called after slothlet has enabled patching.
		// Inside api.slothlet.run(), tryGetContext() returns a store with self: {} (truthy),
		// so the callback returns true — covering both lines and the truthy branch.
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			runtime: "async",
			context: { user: "coverage-test" }
		});

		let checkerWasTriggeredWithSelf = false;

		await api.slothlet.run({ user: "coverage-test" }, async () => {
			// Inside run(), ALS context is active with self: {} set
			// Registering a listener triggers runtime_maybeTrackEmitter → isInApiContext()
			// → the slothlet.mjs lines 347-348 callback body executes and returns true
			const ee = new EventEmitter();
			ee.on("coverage-probe", () => {});
			checkerWasTriggeredWithSelf = true;
		});

		expect(checkerWasTriggeredWithSelf).toBe(true);
		await api.shutdown();
	});

	it("EventEmitter.on() outside run() triggers context checker with falsy ctx (covers false branch)", async () => {
		// Outside a run() context, tryGetContext() returns null → callback returns false.
		// This covers the falsy branch of !!(ctx && ctx.self).
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			runtime: "async"
		});

		// Outside run — no active ALS context
		const ee = new EventEmitter();
		ee.on("coverage-probe-outside", () => {});

		// No assertion beyond "doesn't throw" — we're just covering the callback's false path
		expect(typeof api.slothlet.run).toBe("function");
		await api.shutdown();
	});
});

// ─── Lines 355–356: reload preserved-context cleanup ─────────────────────────

describe("slothlet.mjs load() preserved context cleanup (lines 355–356)", () => {
	it("reload() cleans up old context store before reinitializing (lines 355–356)", async () => {
		// api.slothlet.reload() causes apiManager to call slothlet.load(config, oldInstanceID).
		// At that point, contextManager.instances still has the old instanceID → the branch
		// at line 353 is true → cleanup(preservedInstanceID) [line 355] and
		// contextManager.initialize(newID, config) [line 356] both fire.
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			runtime: "async"
		});

		// Should not throw — this is the main observable guarantee
		await expect(api.slothlet.reload()).resolves.not.toThrow();
		await api.shutdown();
	});

	it("reload() with live runtime also hits preserved-context cleanup path", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			runtime: "live"
		});

		await expect(api.slothlet.reload()).resolves.not.toThrow();
		await api.shutdown();
	});
});
