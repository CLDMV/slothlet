/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/observer-observing-states.test.vitest.mjs
 *	@Date: 2026-11-25T01:43:48-08:00 (1795599828)
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
 * @fileoverview Observers constructed inside and outside a run, through every `observe` / `unobserve` / `disconnect`.
 *
 * @description
 * The observer patch counts an observer constructed in a `run()` / `scope()` as the run's work while it observes
 * anything; one constructed outside every run is only passed through. Node has `PerformanceObserver` only, which has no
 * `unobserve()`; the browser observers that have one are given here as a stand-in `ResizeObserver` global, installed
 * before the patch is turned on, as a polyfill would be. Whether a run is open is told by a stand-in strategy (see
 * `helpers/caller-pinning`) whose run record counts no work, so nothing outlives the case.
 * @module tests/vitests/suites/context/observer-observing-states
 */

import { describe, it, expect, afterEach } from "vitest";
import { enableObserverPatching, disableObserverPatching } from "#helpers/observer-context";
import { setApiCallerPinner } from "#helpers/caller-pinning";

/**
 * A stand-in browser observer: records what it was asked to do.
 */
class StandInObserver {
	constructor(callback) {
		this.callback = callback;
		this.calls = [];
	}
	observe(target) {
		this.calls.push(["observe", target]);
	}
	unobserve(target) {
		this.calls.push(["unobserve", target]);
	}
	disconnect() {
		this.calls.push(["disconnect"]);
	}
}

/**
 * Register a strategy that reports a run is open (its record counts no work) and pins callbacks as they are.
 * @returns {void}
 */
function inRun() {
	const strategy = (callback) => callback;
	strategy.record = () => ({ torn: true });
	strategy.hold = () => null;
	setApiCallerPinner(strategy);
}

afterEach(() => {
	disableObserverPatching();
	setApiCallerPinner(null);
	delete globalThis.ResizeObserver;
});

describe("Context > observers > constructed outside every run", () => {
	it("passes observe, unobserve and disconnect straight through", () => {
		globalThis.ResizeObserver = StandInObserver;
		enableObserverPatching();
		const observer = new ResizeObserver(() => {});
		const target = {};
		observer.observe(target);
		observer.unobserve(target);
		observer.disconnect();
		expect(observer.calls).toEqual([["observe", target], ["unobserve", target], ["disconnect"]]);
	});

	it("passes a PerformanceObserver's observe and disconnect straight through", () => {
		enableObserverPatching();
		const observer = new PerformanceObserver(() => {});
		observer.observe({ entryTypes: ["mark"] });
		observer.disconnect();
		expect(observer).toBeInstanceOf(PerformanceObserver);
	});
});

describe("Context > observers > constructed in a run", () => {
	it("tracks what it observes, through unobserve before and after observe, and disconnect", () => {
		globalThis.ResizeObserver = StandInObserver;
		enableObserverPatching();
		inRun();
		let seen = 0;
		const observer = new ResizeObserver(() => seen++);
		const a = {};
		const b = {};
		observer.unobserve(a);
		observer.observe(a);
		observer.observe(b);
		observer.unobserve(a);
		observer.unobserve(b);
		observer.observe(a);
		observer.disconnect();
		observer.callback();
		expect(seen).toBe(1);
		expect(observer.calls).toEqual([
			["unobserve", a],
			["observe", a],
			["observe", b],
			["unobserve", a],
			["unobserve", b],
			["observe", a],
			["disconnect"]
		]);
	});
});
