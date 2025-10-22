/**
 * @fileoverview Date API module for testing deeply nested module loading. Internal file (not exported in package.json).
 * @module api_test.nested.date
 * @memberof module:api_test
 */

/**
 * Date API object for testing nested folder structures.
 * This module tests slothlet's ability to handle deeply nested directories (nested/date/date.mjs).
 * Accessed as `api.nested.date` in the slothlet API.
 * @alias module:api_test.nested.date
 * @public
 * @property {Function} today - Returns today's date
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.nested.date.today()); // '2025-08-15'
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.nested.date.today()); // '2025-08-15'
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(api_test.nested.date.today()); // '2025-08-15'
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(api_test.nested.date.today()); // '2025-08-15'
 */
export const date =
	/** @lends date */
	{
		/**
		 * Returns today's date as a YYYY-MM-DD formatted string.
		 * @function today
		 * @public
		 * @returns {string} Today's date in YYYY-MM-DD format
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.nested.date.today()); // '2025-08-15'
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.nested.date.today()); // '2025-08-15'
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(api_test.nested.date.today()); // '2025-08-15'
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(api_test.nested.date.today()); // '2025-08-15'
		 */
		today() {
			return "2025-08-15";
		}
	};
