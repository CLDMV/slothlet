/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/lifecycle/lifecycle-uncovered.test.vitest.mjs
 *      @Date: 2026-07-15T00:00:00-07:00 (1752652800)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-15 00:00:00 -07:00 (1752652800)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for Lifecycle handler uncovered branches (lines 116, 146–157).
 *
 * @description
 * Directly instantiates the Lifecycle class with a mock slothlet to reach branches that
 * integration tests never exercise:
 *
 * - Line 116:  `this.off(event, handler)` inside `unsubscribe()` — the `unsubscribe` alias
 *   method is never called through the public API (only `off` is used).
 * - Lines 146–150: `this.eventLog.push(...)` — only fires when `config.debug.lifecycle`
 *   is truthy.
 * - Lines 153–155: `this.eventLog.shift()` — fires when the log exceeds `maxLogSize`.
 * - Lines 157–163: `this.slothlet.debug("lifecycle", {...})` — also under the debug guard.
 *
 * @module tests/vitests/suites/lifecycle/lifecycle-uncovered.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { Lifecycle } from "@cldmv/slothlet/handlers/lifecycle";

/**
 * Build a mock slothlet with configurable debug.lifecycle setting.
 *
 * @param {boolean} [lifecycleDebug=false] - Whether to enable debug.lifecycle.
 * @returns {object} Mock slothlet instance.
 *
 * @example
 * const mock = makeMock(true);
 */
function makeMock(lifecycleDebug = false) {
	return {
		config: { debug: { lifecycle: lifecycleDebug } },
		debug: vi.fn()
	};
}

describe("Lifecycle.unsubscribe (line 116)", () => {
	it("should call off() and remove the handler via unsubscribe()", () => {
		const lc = new Lifecycle(makeMock());
		const handler = vi.fn();

		lc.on("impl:created", handler);
		// Confirm handler was registered
		expect(lc.subscribers.get("impl:created").has(handler)).toBe(true);

		// unsubscribe() is the alias for off() — exercises line 116
		lc.unsubscribe("impl:created", handler);
		expect(lc.subscribers.get("impl:created").has(handler)).toBe(false);
	});

	it("should not throw when unsubscribing a handler that was never registered", () => {
		const lc = new Lifecycle(makeMock());
		const handler = vi.fn();

		// No prior subscribe — should be a no-op via off() path
		expect(() => lc.unsubscribe("impl:created", handler)).not.toThrow();
	});
});

describe("Lifecycle.emit - debug.lifecycle logging (lines 146–157)", () => {
	it("should push to eventLog when debug.lifecycle is true", async () => {
		const mock = makeMock(true);
		const lc = new Lifecycle(mock);

		// No subscribers — avoids getInstanceToken() call path
		await lc.emit("impl:created", { apiPath: "math.add", source: "test", moduleID: "mod1" });

		expect(lc.eventLog).toHaveLength(1);
		expect(lc.eventLog[0].event).toBe("impl:created");
		expect(lc.eventLog[0].data.apiPath).toBe("math.add");
	});

	it("should NOT push to eventLog when debug.lifecycle is false", async () => {
		const mock = makeMock(false);
		const lc = new Lifecycle(mock);

		await lc.emit("impl:created", { apiPath: "math.add", source: "test", moduleID: "mod1" });

		expect(lc.eventLog).toHaveLength(0);
	});

	it("should call slothlet.debug when debug.lifecycle is true (line 157)", async () => {
		const mock = makeMock(true);
		const lc = new Lifecycle(mock);

		await lc.emit("impl:changed", { apiPath: "math.mul", source: "test", moduleID: "mod2" });

		expect(mock.debug).toHaveBeenCalledWith(
			"lifecycle",
			expect.objectContaining({ key: "DEBUG_MODE_LIFECYCLE_EVENT" })
		);
	});

	it("should shift eventLog when length exceeds maxLogSize (lines 153–155)", async () => {
		const mock = makeMock(true);
		const lc = new Lifecycle(mock);

		// Override maxLogSize to a tiny value so we can test the shift() quickly
		lc.maxLogSize = 2;

		await lc.emit("impl:created", { apiPath: "a", source: "t", moduleID: "m1" });
		await lc.emit("impl:created", { apiPath: "b", source: "t", moduleID: "m2" });
		// At this point length === 2 === maxLogSize, no shift yet
		expect(lc.eventLog).toHaveLength(2);

		// Third emit pushes to 3, then shift() trims to 2
		await lc.emit("impl:created", { apiPath: "c", source: "t", moduleID: "m3" });
		expect(lc.eventLog).toHaveLength(2);
		// Oldest entry ("a") was shifted out; newest ("c") is last
		expect(lc.eventLog[lc.eventLog.length - 1].data.apiPath).toBe("c");
	});

	it("should accumulate multiple events in eventLog", async () => {
		const mock = makeMock(true);
		const lc = new Lifecycle(mock);
		lc.maxLogSize = 100;

		for (let i = 0; i < 5; i++) {
			await lc.emit("impl:created", { apiPath: `path.${i}`, source: "t", moduleID: `m${i}` });
		}

		expect(lc.eventLog).toHaveLength(5);
	});
});
