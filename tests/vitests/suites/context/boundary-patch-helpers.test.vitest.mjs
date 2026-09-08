/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/boundary-patch-helpers.test.vitest.mjs
 *	@Date: 2026-07-31 12:00:00 -07:00 (1785524400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-31 12:00:00 -07:00 (1785524400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The boundary patches, exercised directly rather than through an instance.
 *
 * @description
 * The permission suites drive these helpers the way real code does — a module registers a listener
 * or a timer and the runtime carries its identity across. That leaves the edges untested: a listener
 * shape the DOM accepts but slothlet does not wrap, a scheduler the host does not provide, a disable
 * with nothing patched, a repeat registration that has to reuse its wrapper rather than make a second
 * one. Those are the paths where a mistake is silent — a duplicate wrapper fires a listener twice, a
 * dropped property breaks `util.promisify`, an unguarded disable strands a global on a stale function.
 *
 * These tests call the helpers directly for that reason. They patch process-global objects, so every
 * case restores what it touched, and the enable/disable pairing is asserted rather than assumed.
 */

import { describe, it, expect, afterEach } from "vitest";
import { enableSchedulerPatching, disableSchedulerPatching } from "@cldmv/slothlet/helpers/scheduler-context";
import { enableEventTargetPatching, disableEventTargetPatching } from "@cldmv/slothlet/helpers/eventtarget-context";
import {
	enableEventTargetPropertyPatching,
	disableEventTargetPropertyPatching
} from "@cldmv/slothlet/helpers/eventtarget-property-context";
import { enableObserverPatching, disableObserverPatching } from "@cldmv/slothlet/helpers/observer-context";
import { disableEventEmitterPatching } from "@cldmv/slothlet/helpers/eventemitter-context";
import { setApiCallerPinner, pinToCurrentCaller } from "@cldmv/slothlet/helpers/caller-pinning";

describe("Context > boundary patch helpers > caller pinning registry", () => {
	afterEach(() => setApiCallerPinner(null));

	it("hands a callback back untouched when no runtime has registered a strategy", () => {
		setApiCallerPinner(null);
		const cb = () => "x";
		expect(pinToCurrentCaller(cb)).toBe(cb);
	});

	it("hands back non-functions untouched even with a strategy registered", () => {
		setApiCallerPinner(() => () => "wrapped");
		// A boundary can be handed a non-callable; there is nothing to bind, and rejecting it here would
		// change an error the host is supposed to see.
		expect(pinToCurrentCaller(null)).toBeNull();
		expect(pinToCurrentCaller("not-a-function")).toBe("not-a-function");
	});

	it("routes through the registered strategy when there is one", () => {
		const cb = () => "original";
		setApiCallerPinner((listener) => {
			expect(listener).toBe(cb);
			return () => "pinned";
		});
		expect(pinToCurrentCaller(cb)()).toBe("pinned");
	});
});

describe("Context > boundary patch helpers > scheduler patching", () => {
	afterEach(() => disableSchedulerPatching());

	it("is inert on a second disable, so an unpaired call cannot strand a global", () => {
		enableSchedulerPatching();
		disableSchedulerPatching();
		const afterFirst = globalThis.setTimeout;
		disableSchedulerPatching();
		expect(globalThis.setTimeout).toBe(afterFirst);
	});

	it("skips an entry point the host does not provide", () => {
		// `setImmediate` is Node-only; a browser reaches the same code with it absent. Removing it here
		// drives that arm without needing a browser.
		const originalSetImmediate = globalThis.setImmediate;
		// Captured separately: proving "the rest still patched" means comparing setTimeout against its
		// own pre-patch value — compared against the saved setImmediate it would pass unconditionally.
		const realSetTimeout = globalThis.setTimeout;
		delete globalThis.setImmediate;
		try {
			enableSchedulerPatching();
			expect(globalThis.setImmediate).toBeUndefined();
			// The rest still patched despite the gap.
			expect(globalThis.setTimeout).not.toBe(realSetTimeout);
		} finally {
			disableSchedulerPatching();
			globalThis.setImmediate = originalSetImmediate;
		}
	});

	it("carries a scheduler's own properties onto the wrapper", () => {
		// Node hangs promisify support off `setTimeout` as a symbol; consumers reach it through the
		// global they were given, so a wrapper that dropped it would break them process-wide.
		const marker = Symbol("marker");
		globalThis.setTimeout[marker] = "kept";
		globalThis.setTimeout.ownStringKey = "kept-too";
		try {
			enableSchedulerPatching();
			expect(globalThis.setTimeout[marker]).toBe("kept");
			expect(globalThis.setTimeout.ownStringKey).toBe("kept-too");
		} finally {
			disableSchedulerPatching();
			delete globalThis.setTimeout[marker];
			delete globalThis.setTimeout.ownStringKey;
		}
	});

	it("passes a non-function callback straight through to the original", () => {
		enableSchedulerPatching();
		// Legacy string-of-code timers have no identity to carry. The original decides what to do with
		// it — here it rejects — and the wrapper must not change that outcome.
		expect(() => globalThis.setTimeout("code()", 0)).toThrow();
	});

	it("restores the original entry points on disable", () => {
		const before = globalThis.setTimeout;
		enableSchedulerPatching();
		expect(globalThis.setTimeout).not.toBe(before);
		disableSchedulerPatching();
		expect(globalThis.setTimeout).toBe(before);
	});

	it("skips requestAnimationFrame in a host that does not provide it", () => {
		// Node has no requestAnimationFrame natively — this is the same absent-entry-point arm the
		// setImmediate case drives, but pinned to the specific global #349 was filed against.
		expect(globalThis.requestAnimationFrame).toBeUndefined();
		enableSchedulerPatching();
		expect(globalThis.requestAnimationFrame).toBeUndefined();
	});

	it("patches requestAnimationFrame when the host provides it, pinning the callback like the timers", () => {
		// Simulate a browser host: Node has no requestAnimationFrame, so a bare fake stands in for it.
		const calls = [];
		const fakeRaf = function (cb) {
			calls.push(cb);
			return 42;
		};
		globalThis.requestAnimationFrame = fakeRaf;
		try {
			enableSchedulerPatching();
			expect(globalThis.requestAnimationFrame).not.toBe(fakeRaf);

			let pinnedListener = null;
			setApiCallerPinner((listener) => {
				pinnedListener = listener;
				return () => "pinned-result";
			});

			const original = () => "original";
			// The handle must pass straight back untouched, the same way clearTimeout/clearInterval keep
			// working on a setTimeout/setInterval handle — cancelAnimationFrame needs nothing of its own.
			const handle = globalThis.requestAnimationFrame(original);
			expect(handle).toBe(42);
			expect(pinnedListener).toBe(original);
			// The scheduled callback is the pinned wrapper, not the raw original.
			expect(calls[0]()).toBe("pinned-result");
		} finally {
			disableSchedulerPatching();
			delete globalThis.requestAnimationFrame;
			setApiCallerPinner(null);
		}
	});

	it("skips requestIdleCallback in a host that does not provide it", () => {
		// Node has no requestIdleCallback natively — same absent-entry-point arm as requestAnimationFrame,
		// pinned to the specific global #352 was filed against.
		expect(globalThis.requestIdleCallback).toBeUndefined();
		enableSchedulerPatching();
		expect(globalThis.requestIdleCallback).toBeUndefined();
	});

	it("patches requestIdleCallback when the host provides it, pinning the callback like the timers", () => {
		// Simulate a browser host: Node has no requestIdleCallback, so a bare fake stands in for it.
		const calls = [];
		const fakeRic = function (cb) {
			calls.push(cb);
			return 7;
		};
		globalThis.requestIdleCallback = fakeRic;
		try {
			enableSchedulerPatching();
			expect(globalThis.requestIdleCallback).not.toBe(fakeRic);

			let pinnedListener = null;
			setApiCallerPinner((listener) => {
				pinnedListener = listener;
				return () => "pinned-result";
			});

			const original = () => "original";
			// The handle must pass straight back untouched — cancelIdleCallback needs nothing of its own,
			// the same way cancelAnimationFrame needs nothing beyond the raw handle.
			const handle = globalThis.requestIdleCallback(original);
			expect(handle).toBe(7);
			expect(pinnedListener).toBe(original);
			expect(calls[0]()).toBe("pinned-result");
		} finally {
			disableSchedulerPatching();
			delete globalThis.requestIdleCallback;
			setApiCallerPinner(null);
		}
	});

	it("leaves a scheduler alone when something else replaced it after patching", () => {
		// The very behaviour under test — disable declining to reclaim a replaced slot — means nothing
		// downstream will put the real timer back. Capture it first and restore in the finally, or the
		// worker runs the rest of its life on the no-op interloper.
		const realSetTimeout = globalThis.setTimeout;
		try {
			enableSchedulerPatching();
			const interloper = function () {};
			globalThis.setTimeout = interloper;
			disableSchedulerPatching();
			// A test runner's fake timers own that slot and their own restore; writing over them would
			// strand the process on a stale function.
			expect(globalThis.setTimeout).toBe(interloper);
		} finally {
			globalThis.setTimeout = realSetTimeout;
		}
	});
});

describe("Context > boundary patch helpers > EventTarget patching", () => {
	afterEach(() => {
		disableEventTargetPatching();
		setApiCallerPinner(null);
	});

	it("is inert on a second disable", () => {
		enableEventTargetPatching();
		disableEventTargetPatching();
		const afterFirst = EventTarget.prototype.addEventListener;
		disableEventTargetPatching();
		expect(EventTarget.prototype.addEventListener).toBe(afterFirst);
	});

	it("passes through listener shapes it does not wrap", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		// `null` is legal and ignored by the DOM; a plain object is not a listener at all. Both must
		// reach the original unchanged so the host sees the DOM's own behaviour.
		expect(() => target.addEventListener("x", null)).not.toThrow();
		expect(() => target.addEventListener("x", { notAHandler: true })).not.toThrow();
		expect(() => target.dispatchEvent(new Event("x"))).not.toThrow();
	});

	it("wraps the object form and looks up handleEvent at dispatch time", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		const seen = [];
		const listener = {
			handleEvent() {
				seen.push("first");
			}
		};
		target.addEventListener("go", listener);
		target.dispatchEvent(new Event("go"));
		// Swapped between events: the DOM resolves `handleEvent` per dispatch, so the wrapper must not
		// capture it at registration.
		listener.handleEvent = () => seen.push("second");
		target.dispatchEvent(new Event("go"));
		expect(seen).toEqual(["first", "second"]);
	});

	it("treats capture as part of a listener's identity", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		let count = 0;
		const listener = () => count++;
		// Same callback, both capture spellings — the DOM counts these as two distinct listeners.
		// Removal uses the options-object form because Node's own EventTarget does not match a
		// boolean-`true` capture on remove (see the transparency case below); that quirk is the host's,
		// and this case is about identity, not about removal semantics.
		target.addEventListener("go", listener, { capture: true });
		target.addEventListener("go", listener, { capture: false });
		target.dispatchEvent(new Event("go"));
		expect(count).toBe(2);

		target.removeEventListener("go", listener, { capture: true });
		target.dispatchEvent(new Event("go"));
		expect(count).toBe(3);
	});

	it("reproduces the host's boolean-capture removal behaviour exactly, quirk included", () => {
		/**
		 * Register with boolean `true`, remove with boolean `true`, report whether it detached.
		 * @returns {boolean} True when the listener stopped firing.
		 */
		const probe = () => {
			const target = new EventTarget();
			let count = 0;
			const listener = () => count++;
			target.addEventListener("go", listener, true);
			target.dispatchEvent(new Event("go"));
			target.removeEventListener("go", listener, true);
			target.dispatchEvent(new Event("go"));
			return count === 1;
		};

		// Node does not match a boolean-`true` capture on removal — `add(true)` + `rm(true)` leaves the
		// listener attached, while the options-object form removes it. Whatever the host does here, the
		// patch has to do the same: a transparent wrapper reproduces the host's behaviour rather than
		// quietly correcting it, since consumers are already written against the real thing.
		disableEventTargetPatching();
		const unpatched = probe();
		enableEventTargetPatching();
		const patched = probe();

		expect(patched).toBe(unpatched);
	});

	it("accepts the options-object spelling of capture", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		let count = 0;
		const listener = () => count++;
		target.addEventListener("go", listener, { capture: true });
		target.dispatchEvent(new Event("go"));
		expect(count).toBe(1);
		target.removeEventListener("go", listener, { capture: true });
		target.dispatchEvent(new Event("go"));
		expect(count).toBe(1);
	});

	it("reuses one wrapper for a repeated registration", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		let count = 0;
		const listener = () => count++;
		// The spec ignores a duplicate (type, callback, capture). A fresh wrapper per call would be a
		// different reference, so the DOM would attach it as a second listener and fire twice.
		target.addEventListener("go", listener);
		target.addEventListener("go", listener);
		target.dispatchEvent(new Event("go"));
		expect(count).toBe(1);
	});

	it("keeps separate wrappers per target and per type", () => {
		enableEventTargetPatching();
		const a = new EventTarget();
		const b = new EventTarget();
		let count = 0;
		const listener = () => count++;
		a.addEventListener("go", listener);
		b.addEventListener("go", listener);
		a.addEventListener("other", listener);
		a.dispatchEvent(new Event("go"));
		b.dispatchEvent(new Event("go"));
		a.dispatchEvent(new Event("other"));
		expect(count).toBe(3);
	});

	it("removes an untracked listener without disturbing it", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		let count = 0;
		const listener = () => count++;
		// Never registered through the patch, and registered under a different type — both resolve to no
		// tracked wrapper and must fall through to the original.
		expect(() => target.removeEventListener("never-registered", listener)).not.toThrow();
		target.addEventListener("go", listener);
		expect(() => target.removeEventListener("other", listener)).not.toThrow();
		target.dispatchEvent(new Event("go"));
		expect(count).toBe(1);
	});

	it("does not re-wrap a wrapper handed back to it", () => {
		enableEventTargetPatching();
		const target = new EventTarget();
		let count = 0;
		const listener = () => count++;
		target.addEventListener("go", listener);
		const attached = target;
		// Re-registering after a remove starts a fresh wrapper; the point is that neither path stacks
		// wrappers on wrappers.
		attached.removeEventListener("go", listener);
		attached.addEventListener("go", listener);
		attached.dispatchEvent(new Event("go"));
		expect(count).toBe(1);
	});

	it("leaves the methods alone when something else replaced them after patching", () => {
		// Same discipline as the scheduler variant: disable declines the replaced slot by design, so the
		// genuine method must be captured before patching and put back in the finally. (Reading it off
		// `Object.getPrototypeOf(new EventTarget())` afterwards would not do — that IS
		// `EventTarget.prototype`, which holds the interloper at that point.)
		const realAddEventListener = EventTarget.prototype.addEventListener;
		try {
			enableEventTargetPatching();
			const interloper = function () {};
			EventTarget.prototype.addEventListener = interloper;
			disableEventTargetPatching();
			expect(EventTarget.prototype.addEventListener).toBe(interloper);
		} finally {
			EventTarget.prototype.addEventListener = realAddEventListener;
		}
	});
});

describe("Context > boundary patch helpers > EventTarget property (on*) patching", () => {
	afterEach(() => {
		disableEventTargetPropertyPatching();
		delete globalThis.EventSource;
		setApiCallerPinner(null);
	});

	it("is inert when disable is called with nothing patched", () => {
		expect(() => disableEventTargetPropertyPatching()).not.toThrow();
		expect(() => disableEventTargetPropertyPatching()).not.toThrow();
	});

	it("ignores a second enable call", () => {
		class FakeEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				this._onmessage = v;
			}
		}
		globalThis.EventSource = FakeEventSource;
		enableEventTargetPropertyPatching();
		const afterFirst = Object.getOwnPropertyDescriptor(FakeEventSource.prototype, "onmessage");
		enableEventTargetPropertyPatching();
		const afterSecond = Object.getOwnPropertyDescriptor(FakeEventSource.prototype, "onmessage");
		expect(afterSecond.get).toBe(afterFirst.get);
		expect(afterSecond.set).toBe(afterFirst.set);
	});

	it("skips an interface the host does not provide", () => {
		// None of the patched interfaces are Node globals; XMLHttpRequest stands in for "entirely absent".
		expect(globalThis.XMLHttpRequest).toBeUndefined();
		enableEventTargetPropertyPatching();
		expect(globalThis.XMLHttpRequest).toBeUndefined();
	});

	it("skips a property the interface does not declare as an IDL accessor", () => {
		// EventSource's configured properties are onopen/onmessage/onerror. This fake covers all three
		// guard shapes at once: onmessage is a genuine accessor (patched below), onopen is a plain data
		// property (present, but not get/set — skipped), and onerror is entirely absent (skipped).
		class ComboEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				this._onmessage = v;
			}
		}
		Object.defineProperty(ComboEventSource.prototype, "onopen", { value: null, writable: true, configurable: true });
		globalThis.EventSource = ComboEventSource;

		enableEventTargetPropertyPatching();

		const onopenDescriptor = Object.getOwnPropertyDescriptor(ComboEventSource.prototype, "onopen");
		expect(onopenDescriptor.get).toBeUndefined();
		expect(Object.prototype.hasOwnProperty.call(ComboEventSource.prototype, "onerror")).toBe(false);
		// onmessage still got patched despite its siblings being unpatchable.
		const onmessageDescriptor = Object.getOwnPropertyDescriptor(ComboEventSource.prototype, "onmessage");
		expect(onmessageDescriptor.get).not.toBeUndefined();
	});

	it("pins a handler assigned through the accessor, and the getter still returns the original function", () => {
		class FakeEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				this._onmessage = v;
			}
		}
		globalThis.EventSource = FakeEventSource;
		enableEventTargetPropertyPatching();

		const instance = new FakeEventSource();
		// Never assigned yet: the getter has nothing tracked and falls through to the native default.
		expect(instance.onmessage).toBeNull();

		let pinnedListener = null;
		setApiCallerPinner((listener) => {
			pinnedListener = listener;
			return () => "pinned-result";
		});

		const original = () => "original";
		instance.onmessage = original;
		expect(pinnedListener).toBe(original);
		// Transparency: reading the property back returns the exact function assigned, not the wrapper.
		expect(instance.onmessage).toBe(original);
		// What's actually installed under the hood is the pinned wrapper.
		expect(instance._onmessage()).toBe("pinned-result");

		// Deactivating clears the tracked entry and passes null straight through, same as the platform.
		instance.onmessage = null;
		expect(instance._onmessage).toBeNull();
		expect(instance.onmessage).toBeNull();
	});

	it("falls through the getter when the tracked wrapper is no longer what's installed", () => {
		class FakeEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				this._onmessage = v;
			}
		}
		globalThis.EventSource = FakeEventSource;
		enableEventTargetPropertyPatching();

		const instance = new FakeEventSource();
		instance.onmessage = () => {};
		// Bypasses the patched setter entirely, writing straight to the slot the fake's own setter used.
		instance._onmessage = "something-else";
		expect(instance.onmessage).toBe("something-else");
	});

	it("passes a non-function, non-null value straight through untouched", () => {
		class FakeEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				this._onmessage = v;
			}
		}
		globalThis.EventSource = FakeEventSource;
		enableEventTargetPropertyPatching();

		const instance = new FakeEventSource();
		instance.onmessage = "not-a-function";
		expect(instance.onmessage).toBe("not-a-function");
	});

	it("keeps returning the original when a later assignment throws before installing", () => {
		let rejectNext = false;
		class FakeEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				if (rejectNext) throw new Error("platform refused");
				this._onmessage = v;
			}
		}
		globalThis.EventSource = FakeEventSource;
		enableEventTargetPropertyPatching();
		// A real pinner is required so the installed wrapper is a distinct object from the assigned
		// function — with no pinner registered, `pinToCurrentCaller` hands the value through unchanged
		// and the wrapper/original distinction this test exercises collapses.
		setApiCallerPinner((listener) => () => listener());

		const instance = new FakeEventSource();
		const first = () => "first";
		instance.onmessage = first;
		expect(instance.onmessage).toBe(first);

		rejectNext = true;
		const second = () => "second";
		expect(() => {
			instance.onmessage = second;
		}).toThrow("platform refused");

		// The failed second assignment must not have overwritten the tracked entry for the first — the
		// getter still returns the original function that's actually installed, never the raw wrapper.
		expect(instance.onmessage).toBe(first);
	});

	it("keeps the tracked entry when clearing to a non-function value throws", () => {
		let rejectClear = false;
		class FakeEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				if (rejectClear) throw new Error("clear refused");
				this._onmessage = v;
			}
		}
		globalThis.EventSource = FakeEventSource;
		enableEventTargetPropertyPatching();
		// A real pinner is required so the installed wrapper is a distinct object from the assigned
		// function — with no pinner registered, `pinToCurrentCaller` hands the value through unchanged
		// and the wrapper/original distinction this test exercises collapses.
		setApiCallerPinner((listener) => () => listener());

		const instance = new FakeEventSource();
		const original = () => "original";
		instance.onmessage = original;
		expect(instance.onmessage).toBe(original);

		rejectClear = true;
		expect(() => {
			instance.onmessage = "not-a-function";
		}).toThrow("clear refused");

		// The rejected clear must not have deleted the tracked entry — the getter still returns the
		// original function since the platform's installed value never actually changed.
		expect(instance.onmessage).toBe(original);
	});

	it("leaves an accessor alone when something else replaced it after patching", () => {
		class FakeEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				this._onmessage = v;
			}
		}
		globalThis.EventSource = FakeEventSource;
		enableEventTargetPropertyPatching();

		const interloper = { configurable: true, get: () => "x", set: () => {} };
		Object.defineProperty(FakeEventSource.prototype, "onmessage", interloper);
		disableEventTargetPropertyPatching();
		const current = Object.getOwnPropertyDescriptor(FakeEventSource.prototype, "onmessage");
		expect(current.get).toBe(interloper.get);
		expect(current.set).toBe(interloper.set);
	});

	it("does not restore an accessor that was removed entirely after patching", () => {
		class FakeEventSource {
			get onmessage() {
				return this._onmessage ?? null;
			}
			set onmessage(v) {
				this._onmessage = v;
			}
		}
		globalThis.EventSource = FakeEventSource;
		enableEventTargetPropertyPatching();

		delete FakeEventSource.prototype.onmessage;
		expect(() => disableEventTargetPropertyPatching()).not.toThrow();
		expect(Object.getOwnPropertyDescriptor(FakeEventSource.prototype, "onmessage")).toBeUndefined();
	});
});

describe("Context > boundary patch helpers > Observer constructor patching", () => {
	afterEach(() => {
		disableObserverPatching();
		delete globalThis.MutationObserver;
		setApiCallerPinner(null);
	});

	it("is inert when disable is called with nothing patched", () => {
		expect(() => disableObserverPatching()).not.toThrow();
		expect(() => disableObserverPatching()).not.toThrow();
	});

	it("ignores a second enable call", () => {
		class FakeMutationObserver {
			constructor(callback) {
				this.callback = callback;
			}
		}
		globalThis.MutationObserver = FakeMutationObserver;
		enableObserverPatching();
		const afterFirst = globalThis.MutationObserver;
		enableObserverPatching();
		expect(globalThis.MutationObserver).toBe(afterFirst);
	});

	it("skips a constructor the host does not provide", () => {
		// None of the three are Node globals; ResizeObserver stands in for "entirely absent" alongside
		// IntersectionObserver, while MutationObserver is faked present in the other cases below.
		expect(globalThis.ResizeObserver).toBeUndefined();
		expect(globalThis.IntersectionObserver).toBeUndefined();
		enableObserverPatching();
		expect(globalThis.ResizeObserver).toBeUndefined();
		expect(globalThis.IntersectionObserver).toBeUndefined();
	});

	it("pins the callback argument, keeps instanceof and static extras working, and rejects a call without new", () => {
		class FakeMutationObserver {
			constructor(callback, options) {
				this.callback = callback;
				this.options = options;
			}
		}
		const marker = Symbol("marker");
		FakeMutationObserver[marker] = "kept";
		FakeMutationObserver.ownStringKey = "kept-too";
		globalThis.MutationObserver = FakeMutationObserver;

		enableObserverPatching();
		const Patched = globalThis.MutationObserver;
		expect(Patched).not.toBe(FakeMutationObserver);
		expect(Patched[marker]).toBe("kept");
		expect(Patched.ownStringKey).toBe("kept-too");

		let pinnedListener = null;
		setApiCallerPinner((listener) => {
			pinnedListener = listener;
			return () => "pinned-result";
		});

		const original = () => "original";
		const instance = new Patched(original, { childList: true });
		expect(pinnedListener).toBe(original);
		expect(instance.options).toEqual({ childList: true });
		expect(instance.callback()).toBe("pinned-result");
		expect(instance).toBeInstanceOf(FakeMutationObserver);
		expect(instance).toBeInstanceOf(Patched);

		// Class constructors reject a call without `new`; the wrapper must reproduce that failure mode
		// rather than silently proceeding with `new.target` absent.
		expect(() => Patched(original)).toThrow(TypeError);
	});

	it("passes a non-function callback straight through untouched", () => {
		class FakeMutationObserver {
			constructor(callback) {
				this.callback = callback;
			}
		}
		globalThis.MutationObserver = FakeMutationObserver;
		enableObserverPatching();

		const instance = new globalThis.MutationObserver(null);
		expect(instance.callback).toBeNull();
	});

	it("gives the wrapper its own prototype so instance.constructor reflects the patched global", () => {
		class FakeMutationObserver {
			constructor(callback) {
				this.callback = callback;
			}
		}
		globalThis.MutationObserver = FakeMutationObserver;
		enableObserverPatching();
		const Patched = globalThis.MutationObserver;

		const instance = new Patched(() => {});
		// Sharing `original.prototype` verbatim would make `instance.constructor` resolve to the unpatched
		// class instead of the wrapper actually installed as the global.
		expect(instance.constructor).toBe(Patched);
		expect(instance).toBeInstanceOf(FakeMutationObserver);
		expect(instance).toBeInstanceOf(Patched);
	});

	it("restores the original constructor on disable", () => {
		class FakeMutationObserver {
			constructor(callback) {
				this.callback = callback;
			}
		}
		globalThis.MutationObserver = FakeMutationObserver;
		enableObserverPatching();
		expect(globalThis.MutationObserver).not.toBe(FakeMutationObserver);
		disableObserverPatching();
		expect(globalThis.MutationObserver).toBe(FakeMutationObserver);
	});

	it("leaves a constructor alone when something else replaced it after patching", () => {
		class FakeMutationObserver {
			constructor(callback) {
				this.callback = callback;
			}
		}
		globalThis.MutationObserver = FakeMutationObserver;
		enableObserverPatching();
		const interloper = function () {};
		globalThis.MutationObserver = interloper;
		disableObserverPatching();
		expect(globalThis.MutationObserver).toBe(interloper);
	});
});

describe("Context > boundary patch helpers > EventEmitter patching", () => {
	it("is inert when disable is called with nothing patched", () => {
		// shutdown() calls this unconditionally, so an instance that never enabled patching still
		// reaches it. It has to be a no-op rather than restoring undefined over a live prototype.
		expect(() => disableEventEmitterPatching()).not.toThrow();
		expect(() => disableEventEmitterPatching()).not.toThrow();
	});
});
