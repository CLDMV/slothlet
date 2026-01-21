/**
 * @fileoverview Function module for testing slothlet loader with single function export. Internal file (not exported in package.json).
 * @module api_test.funcmod
 * @memberof module:api_test
 */

/**
 * Default function export for testing single function modules.
 * Accessed as `api.funcmod()` in the slothlet API.
 * @alias module:api_test.funcmod
 * @function
 * @public
 * @param {string} name - Name to greet.
 * @returns {string} Greeting message.
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.funcmod("slothlet")); // 'Hello, slothlet!'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.funcmod("slothlet")); // 'Hello, slothlet!'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.funcmod("slothlet")); // 'Hello, slothlet!'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.funcmod("slothlet")); // 'Hello, slothlet!'
 */
export default function (name) {
	return `Hello, ${name}!`;
}
