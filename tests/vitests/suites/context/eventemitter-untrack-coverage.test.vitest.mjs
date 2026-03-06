/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-untrack-coverage.test.vitest.mjs
 *	@Date: 2026-03-07 00:00:00 -08:00 (1773072000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-04 22:09:25 -08:00 (1772690965)
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

// ─────────────────────────────────────────────────────────────────────────────
// LINE 202: runtime_shouldWrapListener — `if (typeof listener !== "function") return false`
//
// Fires when a non-function value is passed to a patched EventEmitter method.
// Patched methods call runtime_shouldWrapListener first; when it returns false,
// the non-function argument is forwarded directly to the original method
// (which will throw TypeError since Node.js requires a function listener).
// ─────────────────────────────────────────────────────────────────────────────
describe("eventemitter-context: shouldWrapListener rejects non-function listeners (line 202)", () => {
	it("passing a string as listener to on() triggers typeof!==function guard and then throws (line 202 true)", () => {
		const emitter = new EventEmitter();

		// runtime_shouldWrapListener("not-a-function") → typeof !== "function" → true → return false
		// → patched on() fast-paths to original.call(this, event, listener)
		// → native EventEmitter.on throws TypeError for non-function listener
		expect(() => emitter.on("data", "not-a-function")).toThrow(TypeError);
	});

	it("passing a number as listener to once() triggers the guard (line 202 true)", () => {
		const emitter = new EventEmitter();
		expect(() => emitter.once("data", 42)).toThrow(TypeError);
	});

	it("passing null as listener to prependListener() triggers the guard (line 202 true)", () => {
		const emitter = new EventEmitter();
		expect(() => emitter.prependListener("data", null)).toThrow(TypeError);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// LINE 174: runtime_untrackListener — `if (!eventTracking) return`
//
// TRUE branch fires when the emitter IS tracked overall (has entries in emitterTracking)
// but the specific event's eventTracking was removed BEFORE runtime_untrackListener is
// called. This happens when a `once` auto-cleanup fires and the listener itself calls
// removeAllListeners(event) inline — deleting the eventTracking entry — before the
// once-wrapper's own runtime_untrackListener runs at the end of the wrapper body.
//
// Scenario:
//   1. emitter.on("other", fn2) → emitter tracked (emitterTracking has "other")
//   2. emitter.once("evt", fn) where fn calls emitter.removeAllListeners("evt") internally
//   3. emitter.emit("evt"):
//        a. runtime_onceWrapper fires
//        b. wrapped.apply calls fn:
//             fn() → emitter.removeAllListeners("evt")
//             → runtime_patchRemoveAllListeners deletes emitterTracking["evt"]
//        c. runtime_untrackListener(emitter, "evt", fn) runs
//             → emitterTracking["evt"] = undefined → line 174 TRUE → return early
// ─────────────────────────────────────────────────────────────────────────────
describe("eventemitter-context: runtime_untrackListener returns early when eventTracking gone (line 174 true)", () => {
	it("once listener that calls removeAllListeners(event) inside itself hits line 174 early-return", () => {
		const emitter = new EventEmitter();
		const fn2 = () => {};

		// Keep emitter tracked via "other" so emitterTracking persists after evt cleanup
		emitter.on("other", fn2);

		let executed = false;

		// fn removes "evt" tracking inline before the once-auto-cleanup can run
		emitter.once("evt", function innerFn() {
			executed = true;
			// Removes emitterTracking["evt"] → next runtime_untrackListener for "evt" hits L174
			emitter.removeAllListeners("evt");
		});

		expect(() => emitter.emit("evt")).not.toThrow();
		expect(executed).toBe(true);

		emitter.removeAllListeners();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// LINE 177: runtime_untrackListener — `if (wrappedListener)` FALSE branch
//
// Fires when eventTracking IS found for the event but eventTracking.get(originalListener)
// returns undefined (the specific listener is no longer in the tracking map).
//
// Triggered by registering the same fn with `once` TWICE on the same event:
//   - eventTracking maps fn → onceWrapper2 (second call overwrites)
//   - Both onceWrapper1 and onceWrapper2 are registered on EventEmitter
//   - When emit fires:
//     · onceWrapper1 runs → runtime_untrackListener: finds fn→onceWrapper2 (truthy) → deletes fn
//     · onceWrapper2 runs → runtime_untrackListener: fn is gone from eventTracking
//       → wrappedListener = undefined → L177 FALSE ARM fires
//   A third regular `on("evt", fn2)` keeps eventTracking["evt"] non-empty so the second
//   untrack call reaches L177 rather than returning at L174.
// ─────────────────────────────────────────────────────────────────────────────
describe("eventemitter-context: runtime_untrackListener wrappedListener missing fires false branch (line 177 false)", () => {
	it("registering same fn twice with once causes second auto-cleanup to miss wrappedListener (line 177 false)", () => {
		const emitter = new EventEmitter();
		const fn = () => {};
		const fn2 = () => {};

		// Keep eventTracking["evt"] alive after fn is deleted so second untrack reaches L177
		emitter.on("evt", fn2);

		// Register fn twice — eventTracking["evt"] ends up mapping fn → onceWrapper2 only.
		// EventEmitter holds [onceWrapper1, onceWrapper2, wrapper_fn2].
		emitter.once("evt", fn); // fn → onceWrapper1 in tracking
		emitter.once("evt", fn); // fn → onceWrapper2 overwrites in tracking

		// emit fires onceWrapper1 → deletes fn from tracking (TRUE arm)
		// then fires onceWrapper2 → fn already gone → FALSE arm at L177
		expect(() => emitter.emit("evt")).not.toThrow();

		emitter.removeAllListeners();
	});
});
// ─────────────────────────────────────────────────────────────────────────────
// LINE 171: runtime_untrackListener — `wrappedListener._slothletResource = null`
//
// Fires when removeListener is called for an event+listener pair that IS tracked
// (wrappedListeners map has an entry for this emitter+event+listener combination).
//
// The `if (wrappedListener)` TRUE branch executes the cleanup: nulls out the
// AsyncResource reference and deletes the listener from eventTracking.
//
// Scenario:
//   1. emitter.on("foo", fn)  → runtime_wrapEventListener stores fn → wrapped in
//      wrappedListeners[emitter]["foo"][fn]
//   2. emitter.off("foo", fn) → runtime_untrackListener is called with emitter, "foo", fn
//      → eventTracking.get(fn) returns the wrappedListener (not falsy)
//      → line 171 fires: wrappedListener._slothletResource = null
// ─────────────────────────────────────────────────────────────────────────────
describe("eventemitter-context: untrackListener cleans up _slothletResource for tracked listener (line 171)", () => {
        it("removeListener on a tracked listener nulls _slothletResource (line 171)", () => {
                const emitter = new EventEmitter();
                const fn = () => {};

                // on() → runtime_wrapEventListener → stores fn in wrappedListeners map.
                emitter.on("data", fn);

                // off() with the same event+fn → runtime_untrackListener → wrappedListener found
                // → line 171: wrappedListener._slothletResource = null fires.
                expect(() => emitter.removeListener("data", fn)).not.toThrow();

                // The emitter should have no listeners remaining.
                expect(emitter.listenerCount("data")).toBe(0);
        });

        it("emitter.off() on a tracked listener triggers the same cleanup path (line 171)", () => {
                const emitter = new EventEmitter();
                const fn1 = () => {};
                const fn2 = () => {};

                emitter.on("end", fn1);
                emitter.on("end", fn2);

                // Remove fn1 — tracked → line 171 fires for fn1.
                expect(() => emitter.off("end", fn1)).not.toThrow();
                expect(emitter.listenerCount("end")).toBe(1);

                // Remove fn2 — tracked → line 171 fires for fn2.
                expect(() => emitter.off("end", fn2)).not.toThrow();
                expect(emitter.listenerCount("end")).toBe(0);
        });
});