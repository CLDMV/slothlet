/**
 * @fileoverview URL utility functions for testing endpoint cleaning and URL building. Internal file (not exported in package.json).
 * @module api_test.util.url
 * @memberof module:api_test
 */

// Runtime imports (unused but required for API structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Stub for cleanEndpoint. Returns the function name as a string.
 * Accessed as `api.util.url.cleanEndpoint()` in the slothlet API.
 * @function cleanEndpoint
 * @public
 * @param {string} endpoint - The endpoint to clean.
 * @param {boolean|string} siteKey - Site key or boolean flag.
 * @param {object} variables - Variables object.
 * @param {boolean|string} apiEndPointVersionOverride - API version override.
 * @param {boolean|string} apiEndPointTypeOverride - API type override.
 * @returns {string} The string "cleanEndpoint".
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.url.cleanEndpoint("sites_list", { site: 'default' })); // "cleanEndpoint"
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.url.cleanEndpoint("sites_list", { site: 'default' })); // "cleanEndpoint"
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.url.cleanEndpoint("sites_list", { site: 'default' })); // "cleanEndpoint"
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.url.cleanEndpoint("sites_list", { site: 'default' })); // "cleanEndpoint"
 */
export function cleanEndpoint(
	..._ // siteKey, variables, apiEndPointVersionOverride, apiEndPointTypeOverride
) {
	// Using endpoint to avoid unused var error
	return "cleanEndpoint";
}

/**
 * Stub for buildUrlWithParams. Returns the function name as a string.
 * Accessed as `api.util.url.buildUrlWithParams()` in the slothlet API.
 * @function buildUrlWithParams
 * @public
 * @param {string} str - Base string/URL to build upon.
 * @param {Object} params - Parameters object to append.
 * @returns {string} The string "buildUrlWithParams".
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })); // "buildUrlWithParams"
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })); // "buildUrlWithParams"
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })); // "buildUrlWithParams"
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })); // "buildUrlWithParams"
 */
export function buildUrlWithParams(str, _ = {}) {
	// Using str to avoid unused var error
	return "buildUrlWithParams";
}
