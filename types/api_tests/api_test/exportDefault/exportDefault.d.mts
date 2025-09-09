/**
 * Named export for extra method that overrides the default export's extra method.
 * This tests how slothlet handles named exports that conflict with default export properties.
 * @function extra
 * @public
 * @returns {string} Overridden extra method message
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.exportDefaultExtra()); // 'extra method overridden'
 */
export function extra(): string;
export default exportDefault;
/**
 * @fileoverview Default export module for testing mixed default and named exports. Internal file (not exported in package.json).
 * @module api_test.exportDefault
 * @memberof module:api_test
 */
/**
 * Default export function for testing export behavior.
 * This function demonstrates how slothlet handles default exports with attached methods.
 * @alias module:api_test.exportDefault
 * @function exportDefault
 * @public
 * @returns {string} Default export message
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.exportDefault()); // 'exportDefault default'
 * console.log(api_test.exportDefault.extra()); // 'extra method'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.exportDefault()); // 'exportDefault default'
 *   console.log(api_test.exportDefault.extra()); // 'extra method'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.exportDefault()); // 'exportDefault default'
 *   console.log(api_test.exportDefault.extra()); // 'extra method'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.exportDefault()); // 'exportDefault default'
 * console.log(api_test.exportDefault.extra()); // 'extra method'
 */
declare function exportDefault(): string;
declare namespace exportDefault {
    /**
     * Extra method attached to the default export function.
     * This tests how slothlet handles function properties.
     * @function extra
     * @public
     * @returns {string} Extra method message
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.exportDefault.extra()); // 'extra method'
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.exportDefault.extra()); // 'extra method'
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.exportDefault.extra()); // 'extra method'
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.exportDefault.extra()); // 'extra method'
     */
    function extra(): string;
}
//# sourceMappingURL=exportDefault.d.mts.map