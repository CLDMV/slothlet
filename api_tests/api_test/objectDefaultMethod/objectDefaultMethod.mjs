/**
 * @fileoverview Object with callable default method for testing mixed object/function behavior. Internal file (not exported in package.json).
 * @module api_test.objectDefaultMethod
 * @memberof module:api_test
 */

/**
 * Object with a callable default method for API loader testing.
 * Accessed as `api.objectDefaultMethod` and `api.objectDefaultMethod()` in the slothlet API.
 * @alias module:api_test.objectDefaultMethod
 * @public
 * @property {function} default - Default method for api.objectDefaultMethod()
 * @property {function} info - Named method for api.objectDefaultMethod.info()
 * @property {function} warn - Named method for api.objectDefaultMethod.warn()
 * @property {function} error - Named method for api.objectDefaultMethod.error()
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.objectDefaultMethod('Hello')); // calls default
 * console.log(api_test.objectDefaultMethod.info('Hello')); // calls info
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.objectDefaultMethod('Hello')); // calls default
 *   console.log(api_test.objectDefaultMethod.info('Hello')); // calls info
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.objectDefaultMethod('Hello')); // calls default
 *   console.log(api_test.objectDefaultMethod.info('Hello')); // calls info
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.objectDefaultMethod('Hello')); // calls default
 * console.log(api_test.objectDefaultMethod.info('Hello')); // calls info
 */
export const objectDefaultMethod =
	/** @lends objectDefaultMethod */
	{
		/**
		 * Default method for objectDefaultMethod. Calls the named method based on level.
		 * @function default
		 * @public
		 * @param {string} message - Message to log.
		 * @param {string} [level="info"] - Level to use ('info', 'warn', 'error').
		 * @returns {string} Formatted message with appropriate level prefix
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'
		 * console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'
		 *   console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'
		 *   console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.objectDefaultMethod('Hello')); // 'INFO: Hello'
		 * console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
		 */
		default(message, level = "info") {
			if (typeof this[level] === "function") {
				return this[level](message);
			} else {
				return this.info(message);
			}
		},
		/**
		 * Info method for objectDefaultMethod.
		 * @function info
		 * @public
		 * @param {string} message - Message to log.
		 * @returns {string} Formatted message with INFO prefix
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.objectDefaultMethod.info('Hello')); // 'INFO: Hello'
		 */
		info(message) {
			return `INFO: ${message}`;
		},
		/**
		 * Warn method for objectDefaultMethod.
		 * @function warn
		 * @public
		 * @param {string} message - Message to log.
		 * @returns {string} Formatted message with WARN prefix
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.objectDefaultMethod.warn('Hello')); // 'WARN: Hello'
		 */
		warn(message) {
			return `WARN: ${message}`;
		},
		/**
		 * Error method for objectDefaultMethod.
		 * @function error
		 * @public
		 * @param {string} message - Message to log.
		 * @returns {string} Formatted message with ERROR prefix
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.objectDefaultMethod.error('Hello')); // 'ERROR: Hello'
		 */
		error(message) {
			return `ERROR: ${message}`;
		}
	};
