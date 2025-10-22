/**
 * @fileoverview Single file function for testing nest3 deeply nested auto-flattening. Internal file (not exported in package.json).
 * @module api_test.advanced.nest3
 * @memberof module:api_test
 */
/**
 * Default function for testing nest3 auto-flattening behavior.
 * Accessed as `api_test.advanced.nest3()` in the slothlet API (auto-flattened).
 * @function
 * @public
 * @param {string} name - Name to greet.
 * @returns {string} Greeting message.
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.advanced.nest3("slothlet")); // 'Hello, slothlet!'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.advanced.nest3("slothlet")); // 'Hello, slothlet!'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.advanced.nest3("slothlet")); // 'Hello, slothlet!'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.advanced.nest3("slothlet")); // 'Hello, slothlet!'
 */
export default function _default(name: string): string;
//# sourceMappingURL=singlefile.d.mts.map
