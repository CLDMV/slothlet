/**
 * @fileoverview Root-level function module (CJS version) for testing slothlet loader with CommonJS modules. Internal file (not exported in package.json).
 * @module api_test_cjs.rootFunction
 * @memberof module:api_test_cjs
 */

let _;
(async () => {
	({ self: _, context: _, reference: _ } = await import("@cldmv/slothlet/runtime"));
})();

/**
 * Greets a name (default export, CJS version).
 * Accessed as the callable function `api()` in the slothlet API.
 * @function greet
 * @alias module:api_test_cjs
 * @public
 * @param {string} name - Name to greet.
 * @returns {string} Greeting message.
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs("World")); // 'Hello, World!'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs("World")); // 'Hello, World!'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs("World")); // 'Hello, World!'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs("World")); // 'Hello, World!'
 */
function greet(name) {
	return `Hello, ${name}!`;
}

/**
 * Shouts a greeting.
 * Accessed as `api.rootFunctionShout()` in the slothlet API.
 * @function shout
 * @memberof module:api_test_cjs
 * @public
 * @param {string} name - Name to shout greeting for.
 * @returns {string} Uppercased greeting message.
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.rootFunctionShout("World")); // 'HELLO, WORLD!'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs.rootFunctionShout("World")); // 'HELLO, WORLD!'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs.rootFunctionShout("World")); // 'HELLO, WORLD!'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.rootFunctionShout("World")); // 'HELLO, WORLD!'
 */
function shout(name) {
	return `HELLO, ${name.toUpperCase()}!`;
}

module.exports = greet;
module.exports.shout = shout;
