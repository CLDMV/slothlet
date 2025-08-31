/**
 * @fileoverview Controller utility functions for testing device and endpoint detection. Internal file (not exported in package.json).
 * @module api_test.util.controller
 * @memberof module:api_test
 */

// Runtime imports (unused but required for API structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Controller object with device and endpoint detection methods.
 * Accessed as `api.util.controller` in the slothlet API.
 * @alias module:api_test.util.controller
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.controller.getDefault()); // "getDefault"
 * console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.controller.getDefault()); // "getDefault"
 *   console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.controller.getDefault()); // "getDefault"
 *   console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.controller.getDefault()); // "getDefault"
 * console.log(api_test.util.controller.detectEndpointType()); // "detectEndpointType"
 */
export const controller =
	/** @lends controller */
	{
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
		getDefault() {
			return "getDefault";
		},
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
		detectEndpointType() {
			return "detectEndpointType";
		},
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
		detectDeviceType() {
			return "detectDeviceType";
		}
	};
