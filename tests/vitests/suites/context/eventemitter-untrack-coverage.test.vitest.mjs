/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-untrack-coverage.test.vitest.mjs
 *	@Date: 2026-03-07 00:00:00 -08:00 (1773072000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-07 00:00:00 -08:00 (1773072000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for eventemitter-context.mjs — uncovered guard branches.
 *
 * @description
 * Targets the following uncovered branches in eventemitter-context.mjs:
 *
 *   Line 157 — `if (!eventTracking) return undefined` in runtime_getWrappedListener
 *              Fires when the EMITTER is tracked (has some events) but the specific EVENT
 *              being looked up has NO tracked listeners. Triggered by removing a listener
 *              from an untracked event whilst the emitter is still tracked for other events.
 *
 *   Line 202 — `if (listener._slothletOriginal) return false` in runtime_shouldWrapListener
 *              Fires when a listener that is already marked as wrapped (has `_slothletOriginal`)
 *              is passed to a patched EventEmitter method. This prevents double-wrapping.
 *              Note: the existing eventemitter-nowrap-branches tests cover addListener/on/
 *              prependListener/once, but each patched method checks runtime_shouldWrapListener
 *              independently. This test verifies the guard specifically.
 *
 * @module tests/vitests/suites/context/eventemitter-untrack-coverage
 *
 * @internal
 * @private
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventEmitter } from "events";
import { enableEventEmitterPatching, disableEventEmitterPatching } from "@cldmv/slothlet/helpers/eventemitter-context";

// Enable patching once for this file; restore afterwards.
beforeAll(() => {
	enableEventEmitterPatching();
});

afterAll(() => {
	disableEventEmitterPatching();
});

// ─────────────────────────────────────────────────────────────────────────────
// LINE 157: runtime_getWrappedListener — `if (!eventTracking) return undefined`
//
// Fires when the emitter IS in wrappedListeners (has some event tracked) but the
// specific event passed to removeListener has NO tracked listener mapping.
//
// Scenario:
//   1. emitter.on("foo", fn) → emitter tracked for "foo"
//   2. emitter.off("bar", fn) → "bar" never tracked → runtime_getWrappedListener
//      sees emitterTracking≠null but eventTracking for "bar" = null → line 157 fires
//      → returns undefined → removeListener treats as no-wrap → no runtime_untrackListener call
// ─────────────────────────────────────────────────────────────────────────────
describe("eventemitter-context: getWrappedListener untracked event returns undefined (line 157)", () => {
	it("removing a listener from an untracked event does not throw (line 157)", () => {
		const emitter = new EventEmitter();
		const fn = () => {};

		// Add listener to "foo" — emitter is now tracked for "foo".
		emitter.on("foo", fn);

		// Remove a listener from "bar" — "bar" was never tracked.
		// Inside removeListener: runtime_getWrappedListener(emitter, "bar", fn) fires.
		// emitterTracking exists (emitter is tracked for "foo"), but eventTracking for "bar"
		// is null → line 157: `if (!eventTracking) return undefined`.
		// No error should be thrown.
		expect(() => emitter.off("bar", fn)).not.toThrow();

		// "foo" listener should still work normally.
		let called = false;
		const fooCb = () => {
			called = true;
		};
		emitter.on("foo", fooCb);
		emitter.emit("foo");
		expect(called).toBe(true);

		// Cleanup
		emitter.removeAllListeners();
	});

	it("removing same listener for different events causes getWrappedListener to return undefined (line 157)", () => {
		const emitter = new EventEmitter();
		const fn = () => {};

		// Add listener to "data".
		emitter.on("data", fn);

		// Remove from "close" (never tracked) — "close" has no eventTracking → line 157.
		expect(() => emitter.off("close", fn)).not.toThrow();
		expect(() => emitter.off("end", fn)).not.toThrow();

		// Cleanup
		emitter.removeAllListeners();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// LINE 202: runtime_shouldWrapListener — `if (listener._slothletOriginal) return false`
//
// The `_slothletOriginal` property is set on `runtime_onceWrapper` (inside patchOnce).
// When such a pre-marked function is passed to any patched method, shouldWrapListener
// returns false at line 202 to prevent double-wrapping.
//
// This test focuses on the `prependListener` path, which is a different code path
// from the `on` path in eventemitter-nowrap-branches — ensuring line 202 is exercised
// via multiple patched methods.
// ─────────────────────────────────────────────────────────────────────────────
describe("eventemitter-context: shouldWrapListener prevents double-wrap (line 202)", () => {
	it("passing a pre-marked listener (_slothletOriginal set) to prependListener skips wrapping (line 202)", () => {
		const emitter = new EventEmitter();

		// Create a function that looks like it's already wrapped (has _slothletOriginal).
		const alreadyWrapped = function testableFn() {};
		alreadyWrapped._slothletOriginal = function originalFn() {};

		// emitter.prependListener calls runtime_shouldWrapListener.
		// Since _slothletOriginal is set, shouldWrapListener returns false (line 202).
		// The original prependListener is called directly without wrapping.
		expect(() => emitter.prependListener("test", alreadyWrapped)).not.toThrow();

		// The listener is registered but NOT double-wrapped.
		// rawListeners should return the function as-is (not wrapped further).
		const raw = emitter.rawListeners("test");
		expect(raw.length).toBe(1);

		// Cleanup
		emitter.removeAllListeners();
	});

	it("passing a pre-marked listener (_slothletOriginal set) to prependOnceListener skips wrapping (line 202)", () => {
		const emitter = new EventEmitter();

		const alreadyWrapped = function anotherFn() {};
		alreadyWrapped._slothletOriginal = function anotherOriginalFn() {};

		// prependOnceListener also calls runtime_shouldWrapListener → line 202 fires.
		expect(() => emitter.prependOnceListener("data", alreadyWrapped)).not.toThrow();

		const raw = emitter.rawListeners("data");
		expect(raw.length).toBe(1);

		// Cleanup
		emitter.removeAllListeners();
	});
});
// ─────────────────────────────────────────────────────────────────────────────
// LINE 390: removeAllListeners(event) — `if (eventTracking)` FALSE branch
//
// Fires when removeAllListeners is called with a specific event name that is NOT
// tracked (the emitter IS tracked overall, but for a different event).
//
// Scenario:
//   1. emitter.on("data", fn)  → emitter tracked for "data"
//   2. emitter.removeAllListeners("close")  → emitter IS in wrappedListeners (tracked),
//      event !== undefined → enters the else branch, but emitterTracking.get("close")
//      returns undefined → line 390: if (eventTracking) is FALSE → cleanup skipped
// ─────────────────────────────────────────────────────────────────────────────
describe("eventemitter-context: removeAllListeners(event) with untracked event skips cleanup (line 390 false)", () => {
        it("removeAllListeners for a specific untracked event does not throw (line 390 false branch)", () => {
                const emitter = new EventEmitter();
                const fn = () => {};

                // Track emitter for "data" event
                emitter.on("data", fn);

                // removeAllListeners("close") — "close" was never tracked
                // emitterTracking exists (for "data") but emitterTracking.get("close") = undefined
                // → line 390: if (eventTracking) → FALSE → cleanup body skipped
                expect(() => emitter.removeAllListeners("close")).not.toThrow();

                // "data" listener still registered (only "close" was targeted)
                expect(emitter.listenerCount("data")).toBe(1);

                emitter.removeAllListeners();
        });

        it("removeAllListeners for another untracked event with multiple tracked events (line 390 false)", () => {
                const emitter = new EventEmitter();
                const fn1 = () => {};
                const fn2 = () => {};

                // Track emitter for both "data" and "end"
                emitter.on("data", fn1);
                emitter.on("end", fn2);

                // removeAllListeners("error") — "error" not tracked → line 390 false
                expect(() => emitter.removeAllListeners("error")).not.toThrow();

                // Both data and end listeners remain
                expect(emitter.listenerCount("data")).toBe(1);
                expect(emitter.listenerCount("end")).toBe(1);

                emitter.removeAllListeners();
        });
});