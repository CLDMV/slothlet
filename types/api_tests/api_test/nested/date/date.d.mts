export namespace date {
    /**
     * Returns today's date as a YYYY-MM-DD formatted string.
     * @function today
     * @public
     * @returns {string} Today's date in YYYY-MM-DD format
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.nested.date.today()); // '2025-08-15'
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.nested.date.today()); // '2025-08-15'
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.nested.date.today()); // '2025-08-15'
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.nested.date.today()); // '2025-08-15'
     */
    function today(): string;
}
//# sourceMappingURL=date.d.mts.map