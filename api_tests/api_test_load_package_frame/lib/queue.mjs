/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_load_package_frame/lib/queue.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:51-08:00 (1795868931)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file only `hrunner` imports. It starts a job queue at its top level.
 * @module api_test_load_package_frame.lib.queue
 */
const jobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

/**
 * Queue a job.
 * @param {function(): void} job - The job.
 * @returns {void}
 * @example
 * enqueue(() => {});
 */
export const enqueue = (job) => {
	jobs.push(job);
};
