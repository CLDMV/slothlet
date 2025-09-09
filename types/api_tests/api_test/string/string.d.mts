export namespace string {
    /**
     * Converts a string to uppercase.
     * @function upper
     * @public
     * @param {string} str - String to convert to uppercase
     * @returns {string} The uppercased string
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.string.upper('world')); // 'WORLD'
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.string.upper('world')); // 'WORLD'
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.string.upper('world')); // 'WORLD'
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.string.upper('world')); // 'WORLD'
     */
    function upper(str: string): string;
    /**
     * Reverses a string character by character.
     * @function reverse
     * @public
     * @param {string} str - String to reverse
     * @returns {string} The reversed string
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.string.reverse('world')); // 'dlrow'
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.string.reverse('world')); // 'dlrow'
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.string.reverse('world')); // 'dlrow'
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.string.reverse('world')); // 'dlrow'
     */
    function reverse(str: string): string;
}
//# sourceMappingURL=string.d.mts.map