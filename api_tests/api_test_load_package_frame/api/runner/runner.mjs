/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_package_frame/api/runner/runner.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T08:00:00-08:00 (1794672000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A module that starts three flows at its top level (a timer's job queue, a chain of promise jobs, and
 * microtasks queued from that chain) and runs code in them later: the bag's functions, or its own code calling the
 * vault through a package, two packages or a host file's function.
 * @module api_test_load_package_frame.runner
 * @memberof module:api_test_load_package_frame
 */
import { self } from "@cldmv/slothlet/runtime";
import { descend } from "callback-walker";
import { relay } from "frame-relay";

const timerJobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => timerJobs.shift()?.(), 1);
timer.unref?.();

const promiseJobs = [];
let wake = null;
/**
 * A chain of promise jobs, started when the file loads: each link runs what was queued, then waits for more.
 * @returns {Promise<void>} The next link.
 */
const pump = () =>
	new Promise((resolve) => {
		wake = resolve;
	}).then(() => {
		while (promiseJobs.length) promiseJobs.shift()();
		pump();
	});
pump();

/**
 * This file's own code calling the vault, outside every export.
 * @param {string} route - `"package"`, `"two"`, `"host"` or `"direct"`.
 * @param {number} depth - How deep the code between recurses.
 * @returns {function(): string} The code.
 */
function own(route, depth) {
	if (route === "package") return () => descend(depth, self.vault.get);
	if (route === "two") return () => relay(depth, self.vault.get);
	if (route === "host") return () => globalThis.__loadPackageFrameWalk(depth, self.vault.get);
	return () => self.vault.get();
}

/**
 * The code a route runs: the bag's function, or this file's own code (`"own-<route>"`).
 * @param {string} route - The route.
 * @param {number} depth - How deep the code between recurses.
 * @returns {Promise<function(): string>} The code.
 */
const codeFor = async (route, depth) => (route.startsWith("own-") ? own(route.slice(4), depth) : await self.bag.give(route, depth));

/**
 * Run code and give what it answered, or the code of the error it threw.
 * @param {function(): (string|Promise<string>)} code - The code.
 * @returns {Promise<string>} The answer.
 */
async function attempt(code) {
	try {
		return await code();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

/**
 * Run a route's code later, in a flow this file started when it loaded.
 * @function later
 * @memberof module:api_test_load_package_frame.runner
 * @param {string} via - `"timer"`, `"promise"` or `"microtask"`.
 * @param {string} route - The route.
 * @param {number} depth - How deep the code between recurses.
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 * @example
 * await api.runner.later("timer", "package", 5); // "SECRET"
 */
export const later = async (via, route, depth) => {
	const code = await codeFor(route, depth);
	return new Promise((resolve) => {
		const job = () => resolve(attempt(code));
		if (via === "timer") timerJobs.push(job);
		else {
			promiseJobs.push(via === "promise" ? job : () => queueMicrotask(job));
			wake?.();
		}
	});
};

/**
 * Run a route's code now, inside this call: what the same code gives called as a function after the load.
 * @function now
 * @memberof module:api_test_load_package_frame.runner
 * @param {string} route - The route.
 * @param {number} depth - How deep the code between recurses.
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 * @example
 * await api.runner.now("package", 5); // "SECRET"
 */
export const now = async (route, depth) => attempt(await codeFor(route, depth));
