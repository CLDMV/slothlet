/**
 * @fileoverview A callable folder: `api.svc()` and `api.svc.start()`, for patterns ending in `.**`.
 * @module api_test_globstar_zero.svc
 * @memberof module:api_test_globstar_zero
 */

/**
 * The folder's own function.
 * @function svc
 * @memberof module:api_test_globstar_zero.svc
 * @returns {string} "svc"
 * @example
 * api.svc(); // "svc"
 */
export default function svc() {
	(globalThis.__slothletGlobstarLog ??= []).push("svc");
	return "svc";
}

/**
 * A function below the folder's own.
 * @function start
 * @memberof module:api_test_globstar_zero.svc
 * @returns {string} "svc.start"
 * @example
 * api.svc.start(); // "svc.start"
 */
export function start() {
	(globalThis.__slothletGlobstarLog ??= []).push("svc.start");
	return "svc.start";
}
