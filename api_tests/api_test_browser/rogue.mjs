/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser/rogue.mjs
 *	@Date: 2026-07-29 12:00:00 -07:00 (1785351600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-29 12:00:00 -07:00 (1785351600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unprivileged caller used to probe permission-bypass routes in browser mode.
 *
 * @description
 * The browser runs the live context manager (no `node:async_hooks`), where caller identity lives
 * in a single ambient field rather than a per-flow store. Every export here reaches a gated target
 * through a route that has, at some point, escaped that field: after an `await`, and while a second
 * module call is suspended concurrently. Nothing here is privileged, so any success is a bypass.
 *
 * Each returns a string rather than throwing so a test can assert on the outcome of several routes
 * in one pass, and so a *redacted* result is distinguishable from a *denied* one.
 *
 * @module api_tests/api_test_browser/rogue
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Classify the outcome of a gated attempt.
 * @param {() => *} fn - Attempt to run.
 * @returns {Promise<string>} "denied" when gated, otherwise "LEAK:<value>".
 * @private
 */
const attempt = async (fn) => {
	try {
		return "LEAK:" + JSON.stringify(await fn());
	} catch (err) {
		return /PERMISSION_DENIED/.test(err.message) ? "denied" : "err:" + String(err.message).slice(0, 40);
	}
};

/**
 * Call a gated target directly, with no await in between — the baseline.
 * @returns {Promise<string>} Outcome.
 */
export const callDirect = () => attempt(() => self.math.add(1, 2));

/**
 * Call a gated target after yielding to the microtask queue.
 * @returns {Promise<string>} Outcome.
 */
export const callAfterAwait = () =>
	attempt(async () => {
		await null;
		return self.math.add(1, 2);
	});

/**
 * Call a gated target after a real timer turn.
 * @returns {Promise<string>} Outcome.
 */
export const callAfterTimer = () =>
	attempt(async () => {
		await new Promise((resolve) => setTimeout(resolve, 1));
		return self.math.add(1, 2);
	});

/**
 * Suspend on a caller-supplied gate, then call a gated target. Paired with a privileged module
 * doing the same, this holds two calls open at once so the ambient identity field names only one
 * of them — the other must not inherit it.
 * @param {Promise<void>} gate - Released by the test once both callers are suspended.
 * @returns {Promise<string>} Outcome.
 */
export const gatedCall = async (gate) => {
	await gate;
	return attempt(() => self.math.add(1, 2));
};

/**
 * Schedule a gated call and return immediately, leaving nothing in flight.
 *
 * Distinct from `callAfterTimer`, which awaits its own timer and so keeps the call suspended across
 * it. Here the call is finished before the callback runs, so the only thing that can attribute the
 * callback is what was captured when the timer was scheduled.
 * @returns {string} `"armed"`.
 */
export const armTimerRead = () => {
	timerOutcome = null;
	setTimeout(async () => {
		timerOutcome = await attempt(() => self.math.add(1, 2));
	}, 5);
	return "armed";
};
let timerOutcome = null;

/**
 * The deferred timer's outcome, or null until it has run. Synchronous, so it cannot suspend and let
 * the callback fire while it is on the stack.
 * @returns {string|null} Outcome.
 */
export const readTimerOutcome = () => timerOutcome;

/**
 * Register a DOM listener that reads a gated target, on an element parked on a global.
 *
 * The element goes on a global so the PAGE dispatches the event rather than this module: a dispatch
 * from here would run the listener inside the dispatching call, where identity is held anyway.
 * `EventTarget` is the browser's real event boundary and the one an `EventEmitter` patch cannot cover.
 * @returns {string} `"armed"`.
 */
export const armDomListener = () => {
	domOutcome = null;
	const target = (globalThis.__slothletProbeTarget = document.createElement("div"));
	target.addEventListener("probe", async () => {
		domOutcome = await attempt(() => self.math.add(1, 2));
	});
	return "armed";
};
let domOutcome = null;

/**
 * The DOM listener's outcome, or null until it has run.
 * @returns {string|null} Outcome.
 */
export const readDomOutcome = () => domOutcome;
