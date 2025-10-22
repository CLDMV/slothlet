export namespace objectDefaultMethod {
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
	 * console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
	 * console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
	 *   console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
	 *   console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.objectDefaultMethod("hello")); // 'INFO: Hello'
	 * console.log(api_test.objectDefaultMethod('Hello', 'warn')); // 'WARN: Hello'
	 */
	function _default(message: string, level?: string): string;
	export { _default as default };
	/**
	 * Info method for objectDefaultMethod.
	 * @function info
	 * @public
	 * @param {string} message - Message to log.
	 * @returns {string} Formatted message with INFO prefix
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.objectDefaultMethod.info("hello")); // 'INFO: Hello'
	 */
	export function info(message: string): string;
	/**
	 * Warn method for objectDefaultMethod.
	 * @function warn
	 * @public
	 * @param {string} message - Message to log.
	 * @returns {string} Formatted message with WARN prefix
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.objectDefaultMethod.warn("hello")); // 'WARN: Hello'
	 */
	export function warn(message: string): string;
	/**
	 * Error method for objectDefaultMethod.
	 * @function error
	 * @public
	 * @param {string} message - Message to log.
	 * @returns {string} Formatted message with ERROR prefix
	 * @example // ESM usage via slothlet API
	 * import slothlet from '@cldmv/slothlet';
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
	 *
	 * @example // ESM usage via slothlet API (inside async function)
	 * async function example() {
	 *   const { default: slothlet } = await import("@cldmv/slothlet");
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
	 * }
	 *
	 * @example // CJS usage via slothlet API (top-level)
	 * let slothlet;
	 * (async () => {
	 *   ({ slothlet } = await import("@cldmv/slothlet"));
	 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
	 *   console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
	 * })();
	 *
	 * @example // CJS usage via slothlet API (inside async function)
	 * const slothlet = require("@cldmv/slothlet");
	 * const api_test = await slothlet({ dir: './api_tests/api_test' });
	 * console.log(api_test.objectDefaultMethod.error("hello")); // 'ERROR: Hello'
	 */
	export function error(message: string): string;
}
//# sourceMappingURL=objectDefaultMethod.d.mts.map
