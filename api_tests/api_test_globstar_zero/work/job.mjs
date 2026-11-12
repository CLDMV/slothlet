/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_globstar_zero/work/job.mjs
 *	@Date: 2026-11-11T21:01:12-08:00 (1794459672)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:16-08:00 (1794477376)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A callable file in a folder: `api.work.job()` and `api.work.job.step()`, for a routine name ending in `.**`.
 * @module api_test_globstar_zero.work.job
 * @memberof module:api_test_globstar_zero
 */

/**
 * The file's own function.
 * @function job
 * @memberof module:api_test_globstar_zero.work.job
 * @returns {string} "work.job"
 * @example
 * api.work.job(); // "work.job"
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
 * api.work.job.step(); // "work.job.step"
 */
export function step() {
	(globalThis.__slothletGlobstarLog ??= []).push("work.job.step");
	return "work.job.step";
}
