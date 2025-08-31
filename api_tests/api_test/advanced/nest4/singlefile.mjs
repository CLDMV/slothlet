/**
 * @fileoverview Single beta function for testing nest4 deeply nested module structures. Internal file (not exported in package.json).
 * @module api_test.advanced.nest4.singlefile
 * @memberof module:api_test
 */

/**
 * Beta function for testing nest4 nested module loading.
 * Accessed as `api_test.advanced.nest4.beta()` in the slothlet API.
 * @function beta
 * @public
 * @param {string} name - Name to greet.
 * @returns {string} Greeting message.
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.advanced.nest4.beta('slothlet')); // 'Hello, slothlet!'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.advanced.nest4.beta('slothlet')); // 'Hello, slothlet!'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.advanced.nest4.beta('slothlet')); // 'Hello, slothlet!'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.advanced.nest4.beta('slothlet')); // 'Hello, slothlet!'
 */
export function beta(name) {
	return `Hello, ${name}!`;
}
