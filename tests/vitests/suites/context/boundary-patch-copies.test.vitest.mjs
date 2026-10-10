/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/boundary-patch-copies.test.vitest.mjs
 *	@Date: 2026-10-09T21:00:00-07:00 (1791604800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T21:00:00-07:00 (1791604800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Two copies of slothlet in one realm enable and disable the boundary patches in any order and leave nothing behind.
 *
 * @description
 * Each copy of the package has its own patch state, but the globals it patches are shared. When copy A
 * patched, copy B patched over A, A disabled (its wrapper was not on top, so it stayed) and B disabled,
 * B put back what it had found — A's wrapper — after A had already forgotten it. That wrapper could no
 * longer be removed, kept pinning for a copy that had disabled, and every later enable layered another
 * one on top of it. A copy's wrapper that cannot be removed now stops pinning, and a restore puts back
 * what is underneath every such wrapper.
 *
 * The second copy is the same source file imported under a query, so it is a separate module instance
 * with its own state, as a second install of the package would be.
 */

import { EventEmitter } from "node:events";
import { describe, it, expect, afterEach } from "vitest";
import { setApiCallerPinner } from "@cldmv/slothlet/helpers/caller-pinning";

/**
 * Import one helper twice: once by package path, once as a separate copy of its source file.
 * @param {string} name - Helper module name, e.g. `"promise-context"`.
 * @returns {Promise<[object, object]>} Copy A and copy B.
 */
async function twoCopies(name) {
	const a = await import(`@cldmv/slothlet/helpers/${name}`);
	const b = await import(new URL(`../../../../src/lib/helpers/${name}.mjs?copy=b`, import.meta.url).href);
	expect(b).not.toBe(a);
	return [a, b];
}

/**
 * Count how many times a callback, or a pin made from it, is pinned.
 * @param {Function} target - The callback whose pins to count.
 * @returns {{count: number}} The running count.
 */
function countPins(target) {
	const seen = { count: 0 };
	const pins = new WeakSet();
	setApiCallerPinner((listener) => {
		if (listener !== target && !pins.has(listener)) return listener;
		seen.count++;
		const pinned = function (...args) {
			return listener.apply(this, args);
		};
		pins.add(pinned);
		return pinned;
	});
	return seen;
}

/**
 * The patched boundaries: how to enable/disable each copy, read what is installed, and register a callback.
 * @type {Array<{label: string, module: string, enable: string, disable: string, read: Function, register: Function}>}
 */
const BOUNDARIES = [
	{
		label: "Promise.prototype.then",
		module: "promise-context",
		enable: "enablePromisePatching",
		disable: "disablePromisePatching",
		read: () => Object.getOwnPropertyDescriptor(Promise.prototype, "then").value,
		register: (cb) => void Promise.resolve().then(cb)
	},
	{
		label: "setTimeout",
		module: "scheduler-context",
		enable: "enableSchedulerPatching",
		disable: "disableSchedulerPatching",
		read: () => globalThis.setTimeout,
		register: (cb) => clearTimeout(setTimeout(cb, 0))
	},
	{
		label: "PerformanceObserver",
		module: "observer-context",
		enable: "enableObserverPatching",
		disable: "disableObserverPatching",
		read: () => globalThis.PerformanceObserver,
		register: (cb) => void new PerformanceObserver(cb)
	},
	{
		label: "EventTarget.prototype.addEventListener",
		module: "eventtarget-context",
		enable: "enableEventTargetPatching",
		disable: "disableEventTargetPatching",
		read: () => EventTarget.prototype.addEventListener,
		register: (cb) => new EventTarget().addEventListener("x", cb)
	},
	{
		label: "AbortSignal.prototype.onabort",
		module: "eventtarget-property-context",
		enable: "enableEventTargetPropertyPatching",
		disable: "disableEventTargetPropertyPatching",
		read: () => Object.getOwnPropertyDescriptor(AbortSignal.prototype, "onabort").get,
		register: (cb) => void (new AbortController().signal.onabort = cb)
	},
	{
		label: "EventEmitter.prototype.on",
		module: "eventemitter-context",
		enable: "enableEventEmitterPatching",
		disable: "disableEventEmitterPatching",
		read: () => EventEmitter.prototype.on,
		register: (cb) => void new EventEmitter().on("x", cb)
	}
];

describe.each(BOUNDARIES)("Context > boundary patches across two package copies > $label", (boundary) => {
	let copies = [];

	afterEach(() => {
		for (const copy of copies) copy[boundary.disable]();
		copies = [];
		setApiCallerPinner(null);
	});

	/**
	 * Load both copies and the value installed before either patched.
	 * @returns {Promise<{a: object, b: object, original: *}>} The copies and the unpatched value.
	 */
	async function setup() {
		const [a, b] = await twoCopies(boundary.module);
		copies = [a, b];
		return { a, b, original: boundary.read() };
	}

	it("A on, B on, A off, B off puts the original back", async () => {
		const { a, b, original } = await setup();
		a[boundary.enable]();
		b[boundary.enable]();
		a[boundary.disable]();
		b[boundary.disable]();
		expect(boundary.read()).toBe(original);
	});

	it("a copy that disabled under another stops pinning, while the other still pins", async () => {
		const { a, b } = await setup();
		a[boundary.enable]();
		b[boundary.enable]();
		a[boundary.disable]();
		const cb = () => {};
		const seen = countPins(cb);
		boundary.register(cb);
		expect(seen.count).toBe(1);
	});

	it("re-enabling after an out-of-order teardown does not stack wrappers", async () => {
		const { a, b, original } = await setup();
		a[boundary.enable]();
		b[boundary.enable]();
		a[boundary.disable]();
		b[boundary.disable]();
		a[boundary.enable]();
		const cb = () => {};
		const seen = countPins(cb);
		boundary.register(cb);
		expect(seen.count).toBe(1);
		a[boundary.disable]();
		expect(boundary.read()).toBe(original);
	});

	it("B on, A on, A off, B off — the in-order teardown — puts the original back too", async () => {
		const { a, b, original } = await setup();
		b[boundary.enable]();
		a[boundary.enable]();
		a[boundary.disable]();
		b[boundary.disable]();
		expect(boundary.read()).toBe(original);
	});

	it("A on, B on, B off, A off puts the original back", async () => {
		const { a, b, original } = await setup();
		a[boundary.enable]();
		b[boundary.enable]();
		b[boundary.disable]();
		a[boundary.disable]();
		expect(boundary.read()).toBe(original);
	});
});
