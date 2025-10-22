/**
 * @fileoverview Auto IP detection functionality for testing task modules. Internal file (not exported in package.json).
 * @module api_test.task.autoIp
 * @memberof module:api_test
 */

// Runtime imports (unused but required for API structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Automatically detects IP configuration.
 * Accessed as `api.task.autoIp()` in the slothlet API.
 * @alias module:api_test.task.autoIp
 * @function autoIP
 * @public
 * @async
 * @returns {Promise<string>} The string "testAutoIP".
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(await api_test.task.autoIp()); // "testAutoIP"
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(await api_test.task.autoIp()); // "testAutoIP"
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(await api_test.task.autoIp()); // "testAutoIP"
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(await api_test.task.autoIp()); // "testAutoIP"
 */
export async function autoIP() {
	return "testAutoIP";
}
