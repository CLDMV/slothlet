/**
 * @fileoverview Alpha function in multi_func for testing function flattening. Internal file (not exported in package.json).
 * @module api_test.multi_func.alpha
 * @memberof module:api_test
 */

/**
 * Alpha function for multi-file API loader test.
 * Accessed as `api.multiFunc.alpha()` in the slothlet API.
 * @function alpha
 * @public
 * @param {string} name - Name parameter for alpha function.
 * @returns {string} Formatted string with alpha prefix.
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.multiFunc.alpha('alpha')); // 'alpha: alpha'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.multiFunc.alpha('alpha')); // 'alpha: alpha'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.multiFunc.alpha('alpha')); // 'alpha: alpha'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.multiFunc.alpha('alpha')); // 'alpha: alpha'
 */
export function alpha(name) {
	return `alpha: ${name}`;
}
