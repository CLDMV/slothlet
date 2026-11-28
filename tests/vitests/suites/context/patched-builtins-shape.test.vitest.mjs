/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/patched-builtins-shape.test.vitest.mjs
 *	@Date: 2026-11-22T18:00:00-08:00 (1795399200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:30-08:00 (1795869090)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The functions slothlet patches keep the original's `name` and `length`, and `node:timers` keeps
 * exporting the very functions the globals are.
 *
 * @description
 * While an instance is up, the scheduler, clearing, observer, EventTarget and EventEmitter entry points are slothlet's
 * wrappers. Code that reads `fn.name`, `fn.length` or compares `require("node:timers").setTimeout` with the global
 * must see what it sees without slothlet. The plain values are read before slothlet first loads.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const require = createRequire(import.meta.url);
const timers = require("node:timers");

/**
 * The patched entry points, read now.
 * @returns {Record<string, Function>} Each entry point by a label.
 */
function entryPoints() {
	return {
		setTimeout: globalThis.setTimeout,
		setInterval: globalThis.setInterval,
		setImmediate: globalThis.setImmediate,
		clearTimeout: globalThis.clearTimeout,
		clearInterval: globalThis.clearInterval,
		clearImmediate: globalThis.clearImmediate,
		queueMicrotask: globalThis.queueMicrotask,
		nextTick: process.nextTick,
		PerformanceObserver: globalThis.PerformanceObserver,
		addEventListener: EventTarget.prototype.addEventListener,
		removeEventListener: EventTarget.prototype.removeEventListener,
		on: EventEmitter.prototype.on,
		addListener: EventEmitter.prototype.addListener,
		once: EventEmitter.prototype.once,
		prependListener: EventEmitter.prototype.prependListener,
		prependOnceListener: EventEmitter.prototype.prependOnceListener,
		removeListener: EventEmitter.prototype.removeListener,
		off: EventEmitter.prototype.off,
		removeAllListeners: EventEmitter.prototype.removeAllListeners
	};
}

/**
 * `name` and `length` of each entry point.
 * @returns {Record<string, [string, number]>} The shape of each.
 */
function shapes() {
	const result = {};
	for (const [label, fn] of Object.entries(entryPoints())) result[label] = [fn.name, fn.length];
	return result;
}

const TIMER_NAMES = ["setTimeout", "setInterval", "setImmediate", "clearTimeout", "clearInterval", "clearImmediate"];
const plain = shapes();
const plainSetTimeout = globalThis.setTimeout;
const plainSame = Object.fromEntries(TIMER_NAMES.map((name) => [name, timers[name] === globalThis[name]]));

describe.each([
	{ runtime: "async", mode: "eager" },
	{ runtime: "live", mode: "eager" },
	{ runtime: "async", mode: "lazy" },
	{ runtime: "live", mode: "lazy" }
])("patched built-ins look like the originals > $runtime/$mode", (config) => {
	let api;

	beforeAll(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
	});

	afterAll(async () => {
		await api?.shutdown();
		api = null;
	});

	it("keeps each original's name and length", () => {
		// The patch is in place: the global timer is slothlet's wrapper, not the plain function.
		expect(globalThis.setTimeout).not.toBe(plainSetTimeout);
		expect(shapes()).toEqual(plain);
	});

	it("keeps node:timers exporting the very functions the globals are", () => {
		expect(Object.fromEntries(TIMER_NAMES.map((name) => [name, timers[name] === globalThis[name]]))).toEqual(plainSame);
	});

	it("still clears a timer set through node:timers with the global clearTimeout, and the other way round", async () => {
		let fired = 0;
		const viaTimers = timers.setTimeout(() => fired++, 5);
		globalThis.clearTimeout(viaTimers);
		const viaGlobal = globalThis.setTimeout(() => fired++, 5);
		timers.clearTimeout(viaGlobal);
		await new Promise((resolve) => timers.setTimeout(resolve, 30));
		expect(fired).toBe(0);
	});
});
