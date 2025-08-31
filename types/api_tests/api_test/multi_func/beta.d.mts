export namespace beta {
    /**
     * Returns a test string.
     * @function hello
     * @public
     * @returns {string} The string 'beta hello'.
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.multiFunc.beta.hello()); // 'beta hello'
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.multiFunc.beta.hello()); // 'beta hello'
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.multiFunc.beta.hello()); // 'beta hello'
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.multiFunc.beta.hello()); // 'beta hello'
     */
    function hello(): string;
}
//# sourceMappingURL=beta.d.mts.map