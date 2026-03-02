/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/lifecycle-uncovered.test.vitest.mjs
 *	@Date: 2026-02-26T17:01:34-08:00 (1772154094)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:52 -08:00 (1772425312)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

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

		expect(mock.debug).toHaveBeenCalledWith("lifecycle", expect.objectContaining({ key: "DEBUG_MODE_LIFECYCLE_EVENT" }));
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
// ─── Line 69: subscribe() returned closure is invoked ────────────────────────────
describe("Lifecycle.subscribe — invoke returned unsubscribe closure (line 69)", () => {
        it("calling the returned closure removes the handler via the if(handlers) guard (line 69)", () => {
                const lc = new Lifecycle(makeMock());
                const handler = vi.fn();

                // subscribe() returns a closure whose body contains line 69: if (handlers)
                const unsub = lc.subscribe("impl:created", handler);
                expect(lc.subscribers.get("impl:created").has(handler)).toBe(true);

                // Invoke the closure — exercises lines 68-70, including the if(handlers) guard
                unsub();
                expect(lc.subscribers.get("impl:created").has(handler)).toBe(false);
        });

        it("subscribe().unsub does not throw when called a second time (line 69 falsy branch)", () => {
                const lc = new Lifecycle(makeMock());
                const handler = vi.fn();

                const unsub = lc.subscribe("impl:created", handler);
                // First call removes the handler
                unsub();
                // Second call routes through line 69 with a live Set (empty) — no throw
                expect(() => unsub()).not.toThrow();
        });
});

// ─── Lines 181-184: async handler rejection ──────────────────────────────────

/**
 * Mock with SlothletWarning for error-catch paths.
 * @param {boolean} [silent=false] - Whether to suppress the warning.
 * @returns {object} Mock slothlet.
 *
 * @example
 * const m = makeMockWithWarning();
 */
function makeMockWithWarning(silent = false) {
        return {
                config: { silent },
                debug: vi.fn(),
                SlothletError,
                SlothletWarning
        };
}

describe("Lifecycle.emit — async handler rejection caught at line 181", () => {
        it("does not reject when an async handler rejects (lines 181-184)", async () => {
                SlothletWarning.suppressConsole = true;
                try {
                        const lc = new Lifecycle(makeMockWithWarning());
                        // This handler returns a rejected promise — triggers lines 178-184
                        lc.subscribe("impl:created", () => Promise.reject(new Error("async fail")));

                        // emit() should resolve without rethrowing the rejection
                        await expect(
                                lc.emit("impl:created", { apiPath: "p", source: "t", moduleID: "m" })
                        ).resolves.not.toThrow();
                } finally {
                        SlothletWarning.suppressConsole = false;
                }
        });

        it("does not log when silent:true and async handler rejects (silent branch, line 181)", async () => {
                const lc = new Lifecycle(makeMockWithWarning(true));
                lc.subscribe("impl:created", () => Promise.reject(new Error("async fail silent")));

                // Should still resolve; the warning is silenced
                await expect(
                        lc.emit("impl:created", { apiPath: "p", source: "t", moduleID: "m" })
                ).resolves.not.toThrow();
        });
});

// ─── Lines 187-192: sync handler throw ──────────────────────────────────────

describe("Lifecycle.emit — sync handler throw caught at line 187", () => {
        it("does not rethrow from a synchronously-throwing handler (lines 187-192)", async () => {
                SlothletWarning.suppressConsole = true;
                try {
                        const lc = new Lifecycle(makeMockWithWarning());
                        // Synchronous throw inside handler — triggers catch at line 187
                        lc.subscribe("impl:created", () => { throw new Error("sync fail"); });

                        await expect(
                                lc.emit("impl:created", { apiPath: "p", source: "t", moduleID: "m" })
                        ).resolves.not.toThrow();
                } finally {
                        SlothletWarning.suppressConsole = false;
                }
        });

        it("does not log when silent:true and sync handler throws (silent branch, line 189)", async () => {
                const lc = new Lifecycle(makeMockWithWarning(true));
                lc.subscribe("impl:created", () => { throw new Error("sync fail silent"); });

                await expect(
                        lc.emit("impl:created", { apiPath: "p", source: "t", moduleID: "m" })
                ).resolves.not.toThrow();
        });
});

// ─── on() return value — unsubscribe function body (line 69) ────────────────────

describe("Lifecycle.on() return value — calling the returned unsubscribe function (line 69)", () => {
        it("calling the unsubscribe fn removes the handler from the subscriber set (line 69)", async () => {
                const lc = new Lifecycle(makeMock());
                let callCount = 0;
                const handler = () => { callCount++; };

                // on() returns an unsubscribe function; line 69 executes when it is called
                const unsub = lc.on("materialized:complete", handler);

                // Verify handler fires before unsubscribing
                await lc.emit("materialized:complete", {});
                expect(callCount).toBe(1);

                // Call the unsubscribe fn — this is the body at line 67–72
                unsub();

                // Handler must NOT fire after unsubscribe
                await lc.emit("materialized:complete", {});
                expect(callCount).toBe(1);
        });

        it("calling unsubscribe on an already-removed handler does not throw (line 69)", () => {
                const lc = new Lifecycle(makeMock());
                const handler = vi.fn();

                const unsub = lc.on("load:start", handler);
                unsub(); // first call removes handler

                // Calling again on an empty/absent set must not throw
                expect(() => unsub()).not.toThrow();
        });
});