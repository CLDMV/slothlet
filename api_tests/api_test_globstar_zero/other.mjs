/**
 * @fileoverview A file no pattern in the tests names.
 * @module api_test_globstar_zero.other
 * @memberof module:api_test_globstar_zero
 */

/**
 * A function no pattern in the tests names.
 * @function ping
 * @memberof module:api_test_globstar_zero.other
 * @returns {string} "pong"
 * @example
 * api.other.ping(); // "pong"
 */
export function ping() {
	(globalThis.__slothletGlobstarLog ??= []).push("other.ping");
	return "pong";
}
