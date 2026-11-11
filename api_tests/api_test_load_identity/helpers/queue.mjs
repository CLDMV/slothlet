/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/helpers/queue.mjs
 *	@Date: 2026-11-11T11:44:49-08:00 (1794426289)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:00-08:00 (1794431580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for what a file starts while it loads: a helper file, no api file, with a job queue it starts
 * draining when it is first imported.
 * @module api_test_load_identity.helpers.queue
 */
const jobs = [];
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

/**
 * Queue a job for the helper's timer.
 * @param {Function} job - The job.
 * @returns {void}
 */
export const push = (job) => {
	jobs.push(job);
};
