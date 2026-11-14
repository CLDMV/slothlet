/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_globstar_zero/work/job.mjs
 *	@Date: 2026-11-11T21:01:12-08:00 (1794459672)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:05:54-08:00 (1794675954)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A callable file in a folder: the folder's only file, so `api.work()` and `api.work.step()`, for a routine name ending in `.**`.
 * @module api_test_globstar_zero.work.job
 * @memberof module:api_test_globstar_zero
 */

/**
 * The file's own function.
 * @function job
 * @memberof module:api_test_globstar_zero.work.job
 * @returns {string} "work.job"
 * @example
 * api.work(); // "work.job"
 */
export default function job() {
	(globalThis.__slothletGlobstarLog ??= []).push("work.job");
	return "work.job";
}

/**
 * A function below the file's own.
 * @function step
 * @memberof module:api_test_globstar_zero.work.job
 * @returns {string} "work.job.step"
 * @example
 * api.work.step(); // "work.job.step"
 */
export function step() {
	(globalThis.__slothletGlobstarLog ??= []).push("work.job.step");
	return "work.job.step";
}
