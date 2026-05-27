/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-multi-register-and-isolation.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 */

/**
 * @fileoverview Regression tests for two specific bug classes in
 * `src/lib/helpers/eventemitter-context.mjs`:
 *
 * 1. **Multi-registration tracking** — Node's `EventEmitter` allows the same
 *    listener function reference to be added multiple times via repeated
 *    `on(event, fn)` calls; each registration must be removed by a
 *    corresponding `removeListener(event, fn)` call. Pre-fix, slothlet's
 *    wrapping tracked at most ONE wrapper per `(emitter, event, original)`
 *    triple, so a second registration overwrote the tracking entry for the
 *    first one — leaking the first wrapper onto the emitter and surfacing as
 *    `MaxListenersExceededWarning` in long-lived connection-pool clients.
 *
 * 2. **Cross-emitter isolation** — There is a reported field symptom where a
 *    timeout on one library's EventEmitter (smithy `ClientRequest`) appears to
 *    trigger an error handler on a wholly unrelated library's EventEmitter
 *    (node-redis `Socket`). The code review of `eventemitter-context.mjs`
 *    did not surface a mechanism for cross-emitter listener bleed — tracking
 *    is keyed by the `(emitter, event, original)` triple, not by listener
 *    identity alone. This test file asserts that isolation holds across a
 *    handful of scenarios so any future regression of the keying strategy
 *    fails loudly here.
 *
 * Bootstraps slothlet with `runtime: "async"` (the patching is installed by
 * the async context manager). Tests then exercise raw `EventEmitter`
 * instances and verify the per-emitter tracking invariants.
 *
 * @module tests/vitests/suites/context/eventemitter-multi-register-and-isolation.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventEmitter } from "node:events";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("EventEmitter — multi-register count + cross-emitter isolation", () => {
	let api;
	beforeAll(async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true
		});
	});
	afterAll(async () => {
		await api?.shutdown?.();
	});

	// ─── Multi-registration: matches Node's count-based semantics ───────────

	it("same listener registered N times → N wrappers added → N removeListener calls remove all", () => {
		const emitter = new EventEmitter();
		const fn = () => {};

		emitter.on("test-event", fn);
		emitter.on("test-event", fn);
		emitter.on("test-event", fn);

		// Each `on` adds one wrapper. Node's listenerCount sees three.
		expect(emitter.listenerCount("test-event")).toBe(3);

		emitter.removeListener("test-event", fn);
		expect(emitter.listenerCount("test-event")).toBe(2);

		emitter.removeListener("test-event", fn);
		expect(emitter.listenerCount("test-event")).toBe(1);

		emitter.removeListener("test-event", fn);
		expect(emitter.listenerCount("test-event")).toBe(0);
	});

	it("same listener registered N times → emit fires the listener N times", () => {
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.on("test-event", fn);
		emitter.on("test-event", fn);
		emitter.on("test-event", fn);

		emitter.emit("test-event");
		expect(calls).toBe(3);
	});

	it("re-registration does NOT exceed maxListeners due to wrapper leak", () => {
		// Regression: pre-fix, repeatedly adding+removing the same listener could
		// leak wrappers on the emitter (tracking only knew about the LATEST
		// wrapper, so the first add's wrapper was un-removable through the
		// patched removeListener). After N add/remove cycles the listener
		// count should return to 0, not stay at N-1.
		const emitter = new EventEmitter();
		const fn = () => {};

		for (let i = 0; i < 15; i++) {
			emitter.on("error", fn);
			emitter.removeListener("error", fn);
		}

		expect(emitter.listenerCount("error")).toBe(0);
	});

	// ─── once + on mixed: each removed independently by its own mechanism ───

	it("mixed `on` + `once` with same listener → once fires once, on persists, removeListener removes the on entry", () => {
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.on("test-event", fn); // wrapper A (persistent)
		emitter.once("test-event", fn); // wrapper B (once)
		expect(emitter.listenerCount("test-event")).toBe(2);

		emitter.emit("test-event");
		expect(calls).toBe(2); // both fired
		expect(emitter.listenerCount("test-event")).toBe(1); // once auto-removed itself

		emitter.emit("test-event");
		expect(calls).toBe(3); // only the persistent one fires now

		emitter.removeListener("test-event", fn);
		expect(emitter.listenerCount("test-event")).toBe(0);

		emitter.emit("test-event");
		expect(calls).toBe(3); // nothing fires
	});

	it("once-wrapper's auto-cleanup removes ITSELF by identity, not LIFO", () => {
		// Regression: if once-wrapper cleaned up via LIFO-pop on the original
		// listener's wrapper array, then `once(fn)` followed by `on(fn)` would
		// pop the on-wrapper when once fires (wrong) — leaving the once-wrapper
		// tracked but already-fired-and-removed by node.
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		emitter.once("test-event", fn); // wrapper B (once) added FIRST
		emitter.on("test-event", fn); // wrapper A (persistent) added SECOND
		expect(emitter.listenerCount("test-event")).toBe(2);

		emitter.emit("test-event");
		expect(calls).toBe(2);
		expect(emitter.listenerCount("test-event")).toBe(1); // once auto-cleaned itself

		// The remaining listener IS the persistent one — verify it can still be removed
		emitter.removeListener("test-event", fn);
		expect(emitter.listenerCount("test-event")).toBe(0);
	});

	// ─── Cross-emitter isolation: no wrapper or listener bleed across emitters ──

	it("two emitters with the same listener function reference do not share wrappers", () => {
		const emitterA = new EventEmitter();
		const emitterB = new EventEmitter();
		let aFired = 0;
		let bFired = 0;
		// Same function reference registered on different emitters
		const shared = function (which) {
			if (which === "a") aFired++;
			else if (which === "b") bFired++;
		};

		emitterA.on("ping", shared);
		emitterB.on("ping", shared);

		// Each emitter has exactly one listener; tracking is per-emitter
		expect(emitterA.listenerCount("ping")).toBe(1);
		expect(emitterB.listenerCount("ping")).toBe(1);

		// Emitting on A only fires A's handler
		emitterA.emit("ping", "a");
		expect(aFired).toBe(1);
		expect(bFired).toBe(0);

		// Emitting on B only fires B's handler
		emitterB.emit("ping", "b");
		expect(aFired).toBe(1);
		expect(bFired).toBe(1);

		// removing the listener on A does NOT affect B's tracking
		emitterA.removeListener("ping", shared);
		expect(emitterA.listenerCount("ping")).toBe(0);
		expect(emitterB.listenerCount("ping")).toBe(1);

		// B's handler still fires correctly after A is cleaned up
		emitterB.emit("ping", "b");
		expect(bFired).toBe(2);
		expect(aFired).toBe(1); // A unchanged
	});

	it("error emit on one emitter does NOT trigger error handlers on a different emitter", () => {
		// Field-report fingerprint: a CloudWatch HTTP timeout (one EventEmitter)
		// allegedly triggers a Redis socket error handler (different EventEmitter).
		// This test asserts the keying strategy genuinely isolates them, so any
		// future change that introduces cross-emitter bleed fails here.
		const emitterA = new EventEmitter();
		const emitterB = new EventEmitter();
		let aErrors = 0;
		let bErrors = 0;
		// Register error handlers (slothlet wraps both)
		emitterA.on("error", () => {
			aErrors++;
		});
		emitterB.on("error", () => {
			bErrors++;
		});

		// Emit a few errors on A — only A's handler should fire
		emitterA.emit("error", new Error("A-1"));
		emitterA.emit("error", new Error("A-2"));
		expect(aErrors).toBe(2);
		expect(bErrors).toBe(0);

		// Now emit on B — only B's handler should fire
		emitterB.emit("error", new Error("B-1"));
		expect(aErrors).toBe(2);
		expect(bErrors).toBe(1);
	});

	it("ten emitters, each with its own error handler, see no cross-fire when any one emits", () => {
		// Stress version of the isolation test — N independent emitters,
		// per-emitter handler counts must stay independent.
		const N = 10;
		const emitters = [];
		const counts = new Array(N).fill(0);
		for (let i = 0; i < N; i++) {
			const e = new EventEmitter();
			const idx = i;
			e.on("error", () => {
				counts[idx]++;
			});
			emitters.push(e);
		}

		// Emit error on emitter 3 only
		emitters[3].emit("error", new Error("3"));
		expect(counts).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);

		// Emit on emitter 7 only
		emitters[7].emit("error", new Error("7"));
		expect(counts).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 0]);

		// Bulk-emit on all — each handler fires exactly once more
		for (const e of emitters) e.emit("error", new Error("bulk"));
		expect(counts).toEqual([1, 1, 1, 2, 1, 1, 1, 2, 1, 1]);
	});

	// ─── Stress test that combines both bug classes ─────────────────────────

	it("60 add+emit+remove cycles on the same listener+emitter leave no leaked wrappers + listener count returns to 0", () => {
		// Approximates the user's reported scenario shape: 62 error events
		// over 30min on a long-lived emitter. After the workload settles, no
		// listeners or wrapper-tracking entries should remain.
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => {
			calls++;
		};

		for (let i = 0; i < 60; i++) {
			emitter.on("error", fn);
			emitter.emit("error", new Error(`cycle-${i}`));
			emitter.removeListener("error", fn);
		}

		expect(calls).toBe(60);
		expect(emitter.listenerCount("error")).toBe(0);
	});
});
