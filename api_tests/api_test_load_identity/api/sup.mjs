/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/api/sup.mjs
 *	@Date: 2026-11-11T13:00:00-08:00 (1794430800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:00:00-08:00 (1794430800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for what a file starts while it loads: a job queue drained by a timer, an async resource and
 * a snapshot of the async context, all made at the top of the file, and a helper file's queue. Each route runs code
 * with no call of this module's below it on the stack.
 * @module api_test_load_identity.sup
 */
import { self } from "@cldmv/slothlet/runtime";
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { push } from "../helpers/queue.mjs";

const snapshot = AsyncLocalStorage.snapshot();
const resource = new AsyncResource("api_test_load_identity");
const jobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

/**
 * Run code, reporting a refusal by its code.
 * @param {Function} fn - The code.
 * @returns {Promise<*>} What it returned, or the code of what it threw.
 */
const settle = async (fn) => {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
};

/**
 * Run code from the file's own timer.
 * @param {Function} fn - The code.
 * @returns {Promise<*>} Its outcome.
 */
const viaTimer = (fn) => new Promise((resolve) => jobs.push(() => resolve(settle(fn))));

/**
 * Run code from a timer the file's own timer sets, with none of this file's code left on the stack.
 * @param {Function} fn - The code.
 * @returns {Promise<*>} Its outcome.
 */
const viaNested = (fn) =>
	new Promise((resolve) =>
		jobs.push(() => {
			let outcome;
			const done = () => resolve(outcome);
			setTimeout(async () => {
				outcome = await settle(fn);
			}, 0);
			setTimeout(done, 10);
		})
	);

/**
 * Run code from the helper file's timer.
 * @param {Function} fn - The code.
 * @returns {Promise<*>} Its outcome.
 */
const viaHelper = (fn) => new Promise((resolve) => push(() => resolve(settle(fn))));

/** Code outside every export. */
const fileLevel = () => self.vault.get();

/**
 * Run one route.
 * @param {string} route - The route's name.
 * @returns {Promise<*>} Its outcome.
 */
export async function probe(route) {
	const made = await self.bag.make();
	const boxed = await self.bag.box();
	if (route === "direct") return settle(() => made());
	if (route === "timerClosure") return viaTimer(made);
	if (route === "timerBoxed") return viaTimer(boxed.run);
	if (route === "timerOwn") return viaTimer(() => self.vault.get());
	if (route === "timerFile") return viaTimer(fileLevel);
	if (route === "nestedClosure") return viaNested(made);
	if (route === "helperClosure") return viaHelper(made);
	if (route === "snapshotClosure") return settle(() => snapshot(made));
	if (route === "resourceClosure") return settle(() => resource.runInAsyncScope(made));
	return "no such route";
}

/**
 * Run a route with no call of this module's waiting on it: the outcome is read with {@link collect}.
 * @param {string} route - The route's name.
 * @returns {void}
 */
export function start(route) {
	pending = probe(route);
}

/**
 * What the route {@link start} began gave.
 * @returns {Promise<*>} Its outcome.
 */
export function collect() {
	return pending;
}

let pending;
