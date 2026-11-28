/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/eventtarget-property-global-handlers.test.vitest.mjs
 *	@Date: 2026-11-25T01:43:23-08:00 (1795599803)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:29-08:00 (1795869089)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `on*` handler patch on a global that is itself an `EventTarget`, and on a host with none.
 *
 * @description
 * A browser's `Window` (or a worker's global) is an `EventTarget` and declares its `on*` handlers on the global object
 * itself, as accessors. The patch finds them there and wraps them like any interface's handlers, so a handler assigned
 * through the global is read back as assigned and runs when the event fires. Node's global is no `EventTarget`; for
 * this case the global is given an `EventTarget` prototype chain and an `on*` accessor of its own for the duration.
 * A host with no `EventTarget` at all has no interfaces to discover, and the patch still turns on and off.
 * @module tests/vitests/suites/context/eventtarget-property-global-handlers
 */

import { pathToFileURL } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { enableEventTargetPropertyPatching, disableEventTargetPropertyPatching } from "#helpers/eventtarget-property-context";
import { internalLibPath } from "../../setup/internal-resolve.mjs";

describe("Context > on* handlers > a global that is an EventTarget", () => {
	it("wraps the global's own handler accessor, and puts it back on disable", () => {
		const target = new EventTarget();
		let handler = null;
		const listener = (event) => handler?.call(globalThis, event);
		target.addEventListener("slothlettest", listener);
		const descriptor = {
			get() {
				return handler;
			},
			set(value) {
				handler = typeof value === "function" ? value : null;
			},
			configurable: true,
			enumerable: true
		};
		const originalProto = Object.getPrototypeOf(globalThis);
		Object.defineProperty(globalThis, "onslothlettest", descriptor);
		Object.setPrototypeOf(globalThis, Object.create(EventTarget.prototype));
		try {
			enableEventTargetPropertyPatching();
			const installed = Object.getOwnPropertyDescriptor(globalThis, "onslothlettest");
			expect(installed.get).not.toBe(descriptor.get);
			let seen = 0;
			const fn = () => seen++;
			globalThis.onslothlettest = fn;
			expect(globalThis.onslothlettest).toBe(fn);
			target.dispatchEvent(new Event("slothlettest"));
			expect(seen).toBe(1);
			globalThis.onslothlettest = null;
			expect(globalThis.onslothlettest).toBe(null);
			disableEventTargetPropertyPatching();
			expect(Object.getOwnPropertyDescriptor(globalThis, "onslothlettest").get).toBe(descriptor.get);
		} finally {
			disableEventTargetPropertyPatching();
			Object.setPrototypeOf(globalThis, originalProto);
			delete globalThis.onslothlettest;
			target.removeEventListener("slothlettest", listener);
		}
	});
});

describe("Context > on* handlers > a host with no EventTarget", () => {
	it("turns on and off without discovering anything", async () => {
		vi.doMock("#helpers/intrinsics", async (importOriginal) => ({ ...(await importOriginal()), EventTarget: undefined }));
		let copy;
		try {
			copy = await import(`${pathToFileURL(internalLibPath("helpers/eventtarget-property-context.mjs")).href}?host=no-event-target`);
		} finally {
			vi.doUnmock("#helpers/intrinsics");
		}
		const before = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "onabort");
		copy.enableEventTargetPropertyPatching();
		const signal = new AbortController().signal;
		const handler = () => {};
		signal.onabort = handler;
		expect(signal.onabort).toBe(handler);
		copy.disableEventTargetPropertyPatching();
		expect(Object.getOwnPropertyDescriptor(AbortSignal.prototype, "onabort").get).toBe(before.get);
	});
});
