/**
 * @fileoverview ESM interoperability module for slothlet mixed API testing.
 * @module api_test_mixed.interop.interopEsm
 * @memberof module:api_test_mixed
 */

import { self, context } from "@cldmv/slothlet/runtime";

/**
 * ESM interoperability object for testing cross-module calls and live bindings.
 * Tests interoperability between ESM and CJS modules via live bindings.
 * Accessed as `api.interop.interopEsm` in the slothlet API.
 * @alias module:api_test_mixed.interop.interopEsm
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 *   console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 *   console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
 */
export const interopEsm =
	/** @lends interopEsm */
	{
		/**
		 * Tests cross-module calls between ESM and CJS with live bindings.
		 * @function testCrossCall
		 * @public
		 * @async
		 * @param {number} a - First number for testing.
		 * @param {number} b - Second number for testing.
		 * @returns {Promise<number>} Result from cross-module call.
		 * @example // ESM usage via slothlet API
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(await api_test_mixed.interop.interopEsm.testCrossCall(2, 3)); // result
		 */
		async testCrossCall(a, b) {
			console.log("ESM Interop: Testing cross-module calls");
			console.log(`ESM Context: User=${context.user}, Instance=${context.instanceName}`);

			// Try to call CJS math via self reference
			if (self && self.mathCjs && typeof self.mathCjs.multiply === "function") {
				console.log("ESM -> CJS call via self reference");
				const result = self.mathCjs.multiply(a, b);
				// const result = await self.mathCjs.multiply(a, b);
				console.log(`ESM received from CJS: ${result}`);
				return result;
			} else {
				throw new Error("CJS mathCjs.multiply not available via self");
			}
		}
	};
