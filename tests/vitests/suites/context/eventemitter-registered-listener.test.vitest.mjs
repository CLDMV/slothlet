/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-registered-listener.test.vitest.mjs
 *	@Date: 2026-11-22T18:00:00-08:00 (1795399200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T18:00:00-08:00 (1795399200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `listeners()`, `listenerCount(event, listener)` and the `newListener` / `removeListener` events report
 * the function the code registered, as they do without slothlet.
 *
 * @description
 * Slothlet attaches a wrapper of its own for each listener registered while an instance is up. What Node reports
 * back about a listener is the registered function: `listeners()` lists it, `listenerCount(event, fn)` counts it, and
 * the `newListener` / `removeListener` handlers receive it. The expected log is the same script run on a plain
 * emitter before slothlet loads.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventEmitter } from "node:events";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Register, inspect, emit and remove listeners, logging what Node reports.
 * @returns {string[]} The log.
 */
function script() {
	const log = [];
	const emitter = new EventEmitter();
	const f = function f() {
		log.push("call:f");
	};
	const g = function g() {
		log.push("call:g");
	};
	const label = (listener) => (listener === f ? "f" : listener === g ? "g" : "?");
	emitter.on("newListener", (event, listener) => log.push(`new:${String(event)}:${label(listener)}`));
	emitter.on("removeListener", (event, listener) => log.push(`removed:${String(event)}:${label(listener)}`));
	emitter.on("x", f);
	emitter.once("x", g);
	emitter.prependListener("x", g);
	emitter.prependOnceListener("x", f);
	log.push(`listeners:${emitter.listeners("x").map(label).join("")}`);
	log.push(`count:f:${emitter.listenerCount("x", f)}`, `count:g:${emitter.listenerCount("x", g)}`);
	emitter.emit("x");
	emitter.off("x", f);
	log.push(`after-off:${emitter.listeners("x").map(label).join("")}`);
	emitter.on("y", f);
	emitter.off("y", f);
	emitter.addListener("z", g);
	emitter.removeAllListeners("z");
	log.push(`z:${emitter.listenerCount("z")}`);
	return log;
}

const plain = script();

describe.each([
	{ runtime: "async", mode: "eager" },
	{ runtime: "live", mode: "eager" },
	{ runtime: "async", mode: "lazy" },
	{ runtime: "live", mode: "lazy" }
])("EventEmitter reports the registered listener > $runtime/$mode", (config) => {
	let api;

	beforeAll(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true });
	});

	afterAll(async () => {
		await api?.shutdown();
		api = null;
	});

	it("outside every run", () => {
		expect(script()).toEqual(plain);
	});

	it("inside a run", async () => {
		expect(await api.slothlet.context.run({ user: "r" }, () => script())).toEqual(plain);
	});
});
