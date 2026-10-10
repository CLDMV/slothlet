/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/boundary-patch-deferred-helpers.test.vitest.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The boundary patches added for #595, exercised directly rather than through an instance.
 *
 * @description
 * Promise reactions, `on*` handlers found by discovery on `EventTarget` interfaces, the
 * `PerformanceObserver` constructor and `scheduler.postTask`. Each patches a process-global, so every
 * case restores what it touched. The pinning strategies registered here pin only the callback the case
 * hands in and pass every other callback through — the promise patch sees every reaction in the
 * process, the test runner's included.
 */

import { describe, it, expect, afterEach } from "vitest";
import { enablePromisePatching, disablePromisePatching, nativeThen } from "@cldmv/slothlet/helpers/promise-context";
import {
	enableEventTargetPropertyPatching,
	disableEventTargetPropertyPatching
} from "@cldmv/slothlet/helpers/eventtarget-property-context";
import { enableObserverPatching, disableObserverPatching } from "@cldmv/slothlet/helpers/observer-context";
import { enableSchedulerPatching, disableSchedulerPatching } from "@cldmv/slothlet/helpers/scheduler-context";
import { setApiCallerPinner } from "@cldmv/slothlet/helpers/caller-pinning";

/**
 * Register a strategy that pins one callback and records the options it was registered with.
 * @param {Function} target - The only callback to pin.
 * @returns {{options: Array<object|undefined>}} What the strategy saw for `target`.
 */
function pinOnly(target) {
	const seen = { options: [] };
	setApiCallerPinner((listener, options) => {
		if (listener !== target) return listener;
		seen.options.push(options);
		return (...args) => `pinned:${target(...args)}`;
	});
	return seen;
}

describe("Context > boundary patch helpers > promise reactions", () => {
	afterEach(() => {
		disablePromisePatching();
		setApiCallerPinner(null);
	});

	it("pins both reactions of then and leaves the method's shape alone", async () => {
		const native = Promise.prototype.then;
		enablePromisePatching();
		expect(Promise.prototype.then).not.toBe(native);
		expect(Promise.prototype.then.name).toBe("then");
		expect(Promise.prototype.then.length).toBe(2);
		expect(Object.getOwnPropertyDescriptor(Promise.prototype, "then").enumerable).toBe(false);

		const onFulfilled = (value) => `ok:${value}`;
		const seen = pinOnly(onFulfilled);
		expect(await Promise.resolve(1).then(onFulfilled)).toBe("pinned:ok:1");
		expect(seen.options).toEqual([undefined]);

		const onRejected = (error) => `caught:${error.message}`;
		pinOnly(onRejected);
		expect(await Promise.reject(new Error("x")).then(undefined, onRejected)).toBe("pinned:caught:x");
	});

	it("covers catch and finally, which register through then", async () => {
		enablePromisePatching();
		const onRejected = (error) => error.message;
		pinOnly(onRejected);
		expect(await Promise.reject(new Error("c")).catch(onRejected)).toBe("pinned:c");

		const calls = [];
		const onFinally = () => calls.push("finally");
		const seen = pinOnly(onFinally);
		await Promise.resolve().finally(onFinally);
		expect(calls).toEqual(["finally"]);
		// finally wraps its callback in engine-made reactions; those are what reach then, not onFinally.
		expect(seen.options).toEqual([]);
	});

	it("nativeThen registers without pinning, even with the patch installed", async () => {
		enablePromisePatching();
		const onFulfilled = (value) => `ok:${value}`;
		const seen = pinOnly(onFulfilled);
		expect(await nativeThen(Promise.resolve(2), onFulfilled)).toBe("ok:2");
		expect(seen.options).toEqual([]);
	});

	it("is inert on a repeat enable and a repeat disable", () => {
		const native = Promise.prototype.then;
		enablePromisePatching();
		const patched = Promise.prototype.then;
		enablePromisePatching();
		expect(Promise.prototype.then).toBe(patched);
		disablePromisePatching();
		expect(Promise.prototype.then).toBe(native);
		expect(() => disablePromisePatching()).not.toThrow();
		expect(Promise.prototype.then).toBe(native);
	});

	it("leaves then alone when something else replaced it after patching", () => {
		const native = Promise.prototype.then;
		enablePromisePatching();
		const replacement = function then(a, b) {
			return native.call(this, a, b);
		};
		Promise.prototype.then = replacement;
		try {
			disablePromisePatching();
			expect(Promise.prototype.then).toBe(replacement);
		} finally {
			Promise.prototype.then = native;
		}
	});

	it("skips a then that is not a plain method", () => {
		const descriptor = Object.getOwnPropertyDescriptor(Promise.prototype, "then");
		const native = descriptor.value;
		Object.defineProperty(Promise.prototype, "then", { configurable: true, get: () => native });
		try {
			enablePromisePatching();
			expect(Object.getOwnPropertyDescriptor(Promise.prototype, "then").get).toBeTypeOf("function");
		} finally {
			Object.defineProperty(Promise.prototype, "then", descriptor);
		}
	});
});

describe("Context > boundary patch helpers > on* handlers found on EventTarget interfaces", () => {
	const installed = [];

	afterEach(() => {
		disableEventTargetPropertyPatching();
		setApiCallerPinner(null);
		while (installed.length) delete globalThis[installed.pop()];
	});

	/**
	 * Expose an interface on the global object, as a host does: a non-enumerable data property.
	 * @param {string} name - Global name.
	 * @param {Function} ctor - Interface constructor.
	 * @returns {void}
	 */
	function expose(name, ctor) {
		Object.defineProperty(globalThis, name, { value: ctor, writable: true, configurable: true });
		installed.push(name);
	}

	/**
	 * A DOM-like interface with `on*` accessors on its own prototype.
	 * @param {string[]} names - Handler property names.
	 * @returns {Function} The interface.
	 */
	function makeInterface(names) {
		const store = new WeakMap();
		class Element extends EventTarget {}
		for (const name of names) {
			Object.defineProperty(Element.prototype, name, {
				configurable: true,
				enumerable: true,
				get() {
					return store.get(this)?.[name] ?? null;
				},
				set(value) {
					store.set(this, { ...store.get(this), [name]: value });
				}
			});
		}
		Element.raw = (target, name) => store.get(target)?.[name];
		return Element;
	}

	it("pins every on* accessor of an interface that descends from EventTarget, and reads back the original", () => {
		const Element = makeInterface(["onclick", "oninput"]);
		expose("SlothletTestElement", Element);
		enableEventTargetPropertyPatching();

		const handler = () => "clicked";
		pinOnly(handler);
		const element = new Element();
		element.onclick = handler;
		expect(element.onclick).toBe(handler);
		expect(Element.raw(element, "onclick")()).toBe("pinned:clicked");
		expect(Object.getOwnPropertyDescriptor(Element.prototype, "oninput").get).not.toBe(undefined);

		disableEventTargetPropertyPatching();
		element.onclick = handler;
		expect(Element.raw(element, "onclick")).toBe(handler);
	});

	it("leaves interfaces that are not EventTargets, accessor-backed globals and non-handler accessors alone", () => {
		const Plain = class {};
		const plainDescriptor = { configurable: true, get: () => null, set: () => {} };
		Object.defineProperty(Plain.prototype, "onclick", plainDescriptor);
		expose("SlothletTestPlain", Plain);

		const Hidden = makeInterface(["onclick"]);
		const hiddenDescriptor = Object.getOwnPropertyDescriptor(Hidden.prototype, "onclick");
		Object.defineProperty(globalThis, "SlothletTestHidden", { get: () => Hidden, configurable: true });
		installed.push("SlothletTestHidden");

		const Named = makeInterface(["on", "once"]);
		expose("SlothletTestNamed", Named);
		const bareOn = Object.getOwnPropertyDescriptor(Named.prototype, "on");

		enableEventTargetPropertyPatching();
		expect(Object.getOwnPropertyDescriptor(Plain.prototype, "onclick").get).toBe(plainDescriptor.get);
		expect(Object.getOwnPropertyDescriptor(Hidden.prototype, "onclick").get).toBe(hiddenDescriptor.get);
		// A property named just `on` is not an event handler attribute.
		expect(Object.getOwnPropertyDescriptor(Named.prototype, "on").get).toBe(bareOn.get);
	});

	it("patches an accessor once when an interface is reached both by name and by discovery", () => {
		const Source = makeInterface(["onopen", "onmessage", "onerror"]);
		const previous = Object.getOwnPropertyDescriptor(globalThis, "EventSource");
		Object.defineProperty(globalThis, "EventSource", { value: Source, writable: true, configurable: true });
		try {
			enableEventTargetPropertyPatching();
			const handler = () => "message";
			let wraps = 0;
			setApiCallerPinner((listener) => {
				if (listener !== handler) return listener;
				wraps++;
				return () => "pinned";
			});
			const source = new Source();
			source.onmessage = handler;
			expect(wraps).toBe(1);
			expect(Source.raw(source, "onmessage")()).toBe("pinned");
		} finally {
			disableEventTargetPropertyPatching();
			if (previous) Object.defineProperty(globalThis, "EventSource", previous);
			else delete globalThis.EventSource;
		}
	});
});

describe("Context > boundary patch helpers > PerformanceObserver and scheduler.postTask", () => {
	afterEach(() => {
		disableObserverPatching();
		disableSchedulerPatching();
		setApiCallerPinner(null);
	});

	it("pins the callback a PerformanceObserver is constructed with", () => {
		const original = globalThis.PerformanceObserver;
		enableObserverPatching();
		expect(globalThis.PerformanceObserver).not.toBe(original);
		const callback = () => "observed";
		const seen = pinOnly(callback);
		const observer = new globalThis.PerformanceObserver(callback);
		expect(observer).toBeInstanceOf(original);
		expect(seen.options).toEqual([undefined]);
		disableObserverPatching();
		expect(globalThis.PerformanceObserver).toBe(original);
	});

	it("pins the callback handed to scheduler.postTask, and skips a host without it", () => {
		expect(globalThis.scheduler).toBe(undefined);
		expect(() => enableSchedulerPatching()).not.toThrow();
		disableSchedulerPatching();

		const posted = [];
		const fakeScheduler = {
			postTask(callback, options) {
				posted.push({ callback, options });
				return Promise.resolve("handle");
			}
		};
		globalThis.scheduler = fakeScheduler;
		const nativePostTask = fakeScheduler.postTask;
		try {
			enableSchedulerPatching();
			const task = () => "task";
			pinOnly(task);
			const options = { priority: "background" };
			expect(globalThis.scheduler.postTask(task, options)).toBeInstanceOf(Promise);
			expect(posted[0].options).toBe(options);
			expect(posted[0].callback()).toBe("pinned:task");
			disableSchedulerPatching();
			expect(globalThis.scheduler.postTask).toBe(nativePostTask);
		} finally {
			delete globalThis.scheduler;
		}
	});
});
