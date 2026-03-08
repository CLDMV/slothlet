/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_mixed/interop/interop-esm.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-08 15:55:43 -07:00 (1773010543)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self, context } from "@cldmv/slothlet/runtime";

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
			if (process.env.DEBUG_MOCK === "1" || process.env.DEBUG_MOCK === "true") {
				console.log("ESM Interop: Testing cross-module calls");
				console.log(`ESM Context: User=${context.user}, Instance=${context.instanceName}`);
			}

			// Try to call CJS math via self reference
			if (self && self.mathCjs && typeof self.mathCjs.multiply === "function") {
				if (process.env.DEBUG_MOCK === "1" || process.env.DEBUG_MOCK === "true") {
					console.log("ESM -> CJS call via self reference");
				}
				const result = self.mathCjs.multiply(a, b);
				// const result = await self.mathCjs.multiply(a, b);
				if (process.env.DEBUG_MOCK === "1" || process.env.DEBUG_MOCK === "true") {
					console.log(`ESM received from CJS: ${result}`);
				}
				return result;
			} else {
				throw new Error("CJS mathCjs.multiply not available via self");
			}
		}
	};
