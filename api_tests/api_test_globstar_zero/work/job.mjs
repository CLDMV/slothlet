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
