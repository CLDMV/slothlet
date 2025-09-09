export namespace interopEsm {
    /**
     * Tests cross-module calls between ESM and CJS with live bindings.
     * @function testCrossCall
     * @public
     * @async
     * @param {number} a - First number for testing.
     * @param {number} b - Second number for testing.
     * @returns {Promise<number>} Result from cross-module call.
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
     * console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
     *   console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
     *   console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
     * console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
     */
    function testCrossCall(a: number, b: number): Promise<number>;
}
//# sourceMappingURL=interop-esm.d.mts.map