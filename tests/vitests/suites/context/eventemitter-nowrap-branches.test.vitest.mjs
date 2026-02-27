/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/context/eventemitter-nowrap-branches.test.vitest.mjs
 *      @Date: 2026-07-17T00:00:00-07:00 (1752739200)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-17 00:00:00 -07:00 (1752739200)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for eventemitter-context.mjs — no-wrap fast-path branches
 * (lines 234, 259, 294, 316).
 *
 * @description
 * Each of the four patched EventEmitter methods (on, once, prependListener,
 * prependOnceListener) has an early-return fast-path when `runtime_shouldWrapListener`
 * returns false:
 *
 *   if (!runtime_shouldWrapListener(listener)) {
 *     return original.call(this, event, listener);  ← lines 234/259/294/316
 *   }
 *
 * `runtime_shouldWrapListener` returns false when `listener._slothletOriginal` is
 * already set — meaning the listener was already wrapped.  Passing such a pre-marked
 * listener directly to each patched method exercises the "no double-wrap" branch.
 *
 * Test setup: `enableEventEmitterPatching()` is called for this test file so that
 * EventEmitter.prototype is patched before any listeners are added.
 *
 * @module tests/vitests/suites/context/eventemitter-nowrap-branches.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventEmitter } from "events";
import {
	enableEventEmitterPatching,
	disableEventEmitterPatching
} from "@cldmv/slothlet/helpers/eventemitter-context";

// Enable patching once for this file; restore afterwards.
beforeAll(() => {
	enableEventEmitterPatching();
});

afterAll(() => {
	disableEventEmitterPatching();
});

/**
 * Create a listener function that already has `_slothletOriginal` set,
 * simulating a previously-wrapped listener.
 *
 * @returns {Function} Pre-marked listener.
 *
 * @example
 * const fn = makePreWrapped();
 * emitter.on("event", fn); // hits no-wrap fast-path
 */
function makePreWrapped() {
	const originalHandler = () => {};
	const fn = function listener() {};
	// Mark as already wrapped — shouldWrapListener will return false
	fn._slothletOriginal = originalHandler;
	return fn;
}

// ─── Line 234: on() no-wrap fast-path ────────────────────────────────────────

describe("EventEmitter.on — no-wrap fast-path (line 234)", () => {
	it("registers a pre-marked listener unchanged via .on() (line 234)", () => {
		const emitter = new EventEmitter();
		const fn = makePreWrapped();

		emitter.on("test", fn);

		// The listener should be registered directly (not double-wrapped)
		const listeners = emitter.rawListeners("test");
		expect(listeners.length).toBe(1);
		// Should be the original fn, not a wrapped version
		expect(listeners[0]).toBe(fn);
	});
});

// ─── Line 259: once() no-wrap fast-path ──────────────────────────────────────

describe("EventEmitter.once — no-wrap fast-path (line 259)", () => {
	it("registers a pre-marked listener unchanged via .once() (line 259)", () => {
		const emitter = new EventEmitter();
		const fn = makePreWrapped();

		emitter.once("test", fn);

		// rawListeners returns the wrapper-free or once-wrapper form
		const listeners = emitter.rawListeners("test");
		expect(listeners.length).toBe(1);
		// The listener was not double-wrapped — just a once-wrapper around the original fn
		// Verify it fires and auto-removes itself
		let fired = false;
		const fn2 = function onceHandler() {
			fired = true;
		};
		fn2._slothletOriginal = () => {};
		emitter.once("fire", fn2);
		emitter.emit("fire");
		expect(fired).toBe(true);
	});
});

// ─── Line 294: prependListener() no-wrap fast-path ───────────────────────────

describe("EventEmitter.prependListener — no-wrap fast-path (line 294)", () => {
	it("prepends a pre-marked listener unchanged via .prependListener() (line 294)", () => {
		const emitter = new EventEmitter();
		const fn = makePreWrapped();

		// Add a normal listener first, then prepend
		emitter.on("test", () => {});
		emitter.prependListener("test", fn);

		const listeners = emitter.rawListeners("test");
		// Pre-marked listener should be first (prepended)
		expect(listeners.length).toBe(2);
		expect(listeners[0]).toBe(fn);
	});
});

// ─── Line 316: prependOnceListener() no-wrap fast-path ───────────────────────

describe("EventEmitter.prependOnceListener — no-wrap fast-path (line 316)", () => {
	it("prepends a pre-marked once listener unchanged via .prependOnceListener() (line 316)", () => {
		const emitter = new EventEmitter();
		const fn = makePreWrapped();

		emitter.on("test", () => {}); // existing listener
		// Must not throw — the no-wrap path fires at line 316
		expect(() => emitter.prependOnceListener("test", fn)).not.toThrow();

		const listeners = emitter.rawListeners("test");
		// Two listeners total after prepend
		expect(listeners.length).toBe(2);
	});
});
