/**
 * @fileoverview Utility functions module for testing nested namespace behavior. Internal file (not exported in package.json).
 * @module api_test.util.util
 * @memberof module:api_test
 */

// Runtime imports (unused but required for API structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Returns a string indicating size functionality.
 * Accessed as `api.util.size()` in the slothlet API.
 * @function size
 * @public
 * @param {*} variable - Variable parameter (currently unused).
 * @returns {string} The string "size".
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.util.size('test')); // 'size'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.util.size('test')); // 'size'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.util.size('test')); // 'size'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.util.size('test')); // 'size'
 */
export function size(_) {
	return "size";
}

/**
 * Returns a string indicating second function functionality.
 * Accessed as `api.util.secondFunc()` in the slothlet API.
 * @function secondFunc
 * @public
 * @param {*} variable - Variable parameter (currently unused).
 * @returns {string} The string "secondFunc".
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.util.secondFunc('test')); // 'secondFunc'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.util.secondFunc('test')); // 'secondFunc'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.util.secondFunc('test')); // 'secondFunc'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.util.secondFunc('test')); // 'secondFunc'
 */
export function secondFunc(_) {
	return "secondFunc";
}
