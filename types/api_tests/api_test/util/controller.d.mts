export namespace controller {
    /**
     * Gets the default value.
     * @function getDefault
     * @public
     * @returns {string} The string "getDefault".
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.util.controller.getDefault()); // "getDefault"
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.util.controller.getDefault()); // "getDefault"
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.util.controller.getDefault()); // "getDefault"
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.util.controller.getDefault()); // "getDefault"
     */
    function getDefault(): string;
    /**
     * Detects the endpoint type.
     * @function detectEndpointType
     * @public
     * @returns {string} The string "detectEndpointType".
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
     */
    function detectEndpointType(): string;
    /**
     * Detects the device type.
     * @function detectDeviceType
     * @public
     * @returns {string} The string "detectDeviceType".
     * @example // ESM usage via slothlet API
     * import slothlet from '@cldmv/slothlet';
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
     *
     * @example // ESM usage via slothlet API (inside async function)
     * async function example() {
     *   const { default: slothlet } = await import('@cldmv/slothlet');
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
     * }
     *
     * @example // CJS usage via slothlet API (top-level)
     * let slothlet;
     * (async () => {
     *   ({ slothlet } = await import('@cldmv/slothlet'));
     *   const api_test = await slothlet({ dir: './api_tests/api_test' });
     *   console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
     * })();
     *
     * @example // CJS usage via slothlet API (inside async function)
     * const slothlet = require('@cldmv/slothlet');
     * const api_test = await slothlet({ dir: './api_tests/api_test' });
     * console.log(api_test.util.controller.detectDeviceType()); // "detectDeviceType"
     */
    function detectDeviceType(): string;
}
//# sourceMappingURL=controller.d.mts.map