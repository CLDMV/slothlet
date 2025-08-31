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
export function size(variable: any): string;
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
export function secondFunc(variable: any): string;
//# sourceMappingURL=util.d.mts.map