/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lock_caller_caller/scheduler/service.mjs
 *	@Date: 2026-09-28T00:00:00-07:00 (1790578800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:38-07:00 (1791090878)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Scheduler-style service for the `lockCaller.caller()` tests (#477).
 *
 * @description
 * Accepts callbacks on behalf of whoever calls it and runs them later from {@link fire}. `every`
 * pins the CALLER of `every` onto the job (`self.slothlet.lockCaller.caller`); `everyAsSelf` pins the
 * service itself (`self.slothlet.lockCaller`) for comparison.
 *
 * @module api_tests/api_test_lock_caller_caller/scheduler/service
 */

import { self } from "@cldmv/slothlet/runtime";

let jobs = [];

/**
 * Store a job pinned to the identity of whoever called this leaf.
 * @param {Function} job - Callback to run on {@link fire}.
 * @returns {number} The number of stored jobs.
 * @public
 * @example
 * api.scheduler.service.every(() => 1);
 */
export function every(job) {
	jobs.push(self.slothlet.lockCaller.caller(job));
	return jobs.length;
}

/**
 * Store a job pinned to this service (plain `lockCaller`).
 * @param {Function} job - Callback to run on {@link fire}.
 * @returns {number} The number of stored jobs.
 * @public
 * @example
 * api.scheduler.service.everyAsSelf(() => 1);
 */
export function everyAsSelf(job) {
	jobs.push(self.slothlet.lockCaller(job));
	return jobs.length;
}

/**
 * Return the `lockCaller.caller()` wrapper for `job` without storing it.
 * @param {Function} job - Callback to pin.
 * @returns {Function} The pinned wrapper.
 * @public
 * @example
 * api.scheduler.service.pin(() => 1);
 */
export function pin(job) {
	return self.slothlet.lockCaller.caller(job);
}

/**
 * Run every stored job, sequentially, forwarding `args`.
 * @param {...*} args - Arguments forwarded to each job.
 * @returns {Promise<Array<*>>} Each job's (awaited) result.
 * @public
 * @example
 * await api.scheduler.service.fire();
 */
export async function fire(...args) {
	const results = [];
	for (const job of jobs) results.push(await job(...args));
	return results;
}

/**
 * Run every stored job concurrently, forwarding `args`.
 * @param {...*} args - Arguments forwarded to each job.
 * @returns {Promise<Array<*>>} Each job's result.
 * @public
 * @example
 * await api.scheduler.service.fireAll();
 */
export function fireAll(...args) {
	return Promise.all(jobs.map((job) => job(...args)));
}

/**
 * Run every stored job synchronously with an explicit `this`, returning the raw results.
 * @param {*} thisArg - `this` binding for each job.
 * @param {...*} args - Arguments forwarded to each job.
 * @returns {Array<*>} Each job's result.
 * @public
 * @example
 * api.scheduler.service.fireWith({ tag: 1 });
 */
export function fireWith(thisArg, ...args) {
	return jobs.map((job) => job.apply(thisArg, args));
}

/**
 * The raw stored job wrappers (for metadata inspection).
 * @returns {Function[]} The stored wrappers.
 * @public
 * @example
 * api.scheduler.service.list();
 */
export function list() {
	return [...jobs];
}

/**
 * Drop every stored job.
 * @returns {void}
 * @public
 * @example
 * api.scheduler.service.clear();
 */
export function clear() {
	jobs = [];
}
