/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lock_caller_caller/client/app.mjs
 *	@Date: 2026-09-28 00:00:00 -07:00 (1790578800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:50 -07:00 (1791082970)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Client module for the `lockCaller.caller()` tests (#477). Schedules jobs on the
 * scheduler service; each job calls a probe target, so the target sees whichever identity the job
 * runs as.
 *
 * @module api_tests/api_test_lock_caller_caller/client/app
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Schedule a job that reports who the target sees calling it, pinned to this client.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleWhoami();
 */
export function scheduleWhoami() {
	return self.scheduler.service.every(() => self.target.probe.whoami());
}

/**
 * Same job, but the scheduler pins itself (`lockCaller`), for comparison.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleWhoamiAsService();
 */
export function scheduleWhoamiAsService() {
	return self.scheduler.service.everyAsSelf(() => self.target.probe.whoami());
}

/**
 * Schedule a job that calls the client-only guarded route.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleGuarded();
 */
export function scheduleGuarded() {
	return self.scheduler.service.every(() => self.target.probe.guarded());
}

/**
 * Schedule the guarded job with the scheduler pinning itself, for comparison.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleGuardedAsService();
 */
export function scheduleGuardedAsService() {
	return self.scheduler.service.everyAsSelf(() => self.target.probe.guarded());
}

/**
 * Schedule an async job that awaits a timer before reporting who the target sees.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleAsyncWhoami();
 */
export function scheduleAsyncWhoami() {
	return self.scheduler.service.every(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
		return self.target.probe.whoami();
	});
}

/**
 * Schedule a job that throws a TypeError.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleThrow();
 */
export function scheduleThrow() {
	return self.scheduler.service.every(() => {
		throw new TypeError("job-boom");
	});
}

/**
 * Schedule a job that returns its own `this` and arguments.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleThisAndArgs();
 */
export function scheduleThisAndArgs() {
	return self.scheduler.service.every(function thisAndArgs(...args) {
		return { self: this, args };
	});
}

/**
 * Schedule a job that calls the principal-gated route for the project it is fired with.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleFiles();
 */
export function scheduleFiles() {
	return self.scheduler.service.every((projectId) => self.target.probe.files(projectId));
}

/**
 * Call the principal-gated route directly as this client.
 * @param {string} projectId - Project id.
 * @returns {{projectId: string}} The project marker.
 * @public
 * @example
 * api.client.app.readFiles("p1");
 */
export function readFiles(projectId) {
	return self.target.probe.files(projectId);
}

/**
 * The principal-gated job with the scheduler pinning itself, for comparison.
 * @returns {number} Stored job count.
 * @public
 * @example
 * api.client.app.scheduleFilesAsService();
 */
export function scheduleFilesAsService() {
	return self.scheduler.service.everyAsSelf((projectId) => self.target.probe.files(projectId));
}

/**
 * Ask the scheduler for a pinned wrapper and hand back both it and the original callback.
 * @returns {{wrapper: Function, original: Function}} The wrapper and the callback it pins.
 * @public
 * @example
 * api.client.app.pinThroughScheduler();
 */
export function pinThroughScheduler() {
	const original = () => "original";
	return { wrapper: self.scheduler.service.pin(original), original };
}

/**
 * Call `lockCaller.caller` directly from this (ungranted) client.
 * @returns {Function} The pinned wrapper (only when granted).
 * @public
 * @example
 * api.client.app.pinDirectly();
 */
export function pinDirectly() {
	return self.slothlet.lockCaller.caller(() => 0);
}

/**
 * Fire the scheduler from inside this client, so the client is the ambient identity.
 * @returns {Promise<Array<*>>} The jobs' results.
 * @public
 * @example
 * await api.client.app.fireFromClient();
 */
export function fireFromClient() {
	return self.scheduler.service.fire();
}
