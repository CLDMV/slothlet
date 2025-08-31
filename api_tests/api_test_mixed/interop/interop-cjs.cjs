/**
 * @fileoverview CJS interoperability module for slothlet mixed API testing. Internal file (not exported in package.json).
 * @module api_test_mixed.interop.interopCjs
 * @memberof module:api_test_mixed
 */

let self, context, reference;
(async () => {
	({ self, context, reference } = await import("@cldmv/slothlet/runtime"));
})();

/**
 * CJS interoperability object for testing cross-module calls and live bindings.
 * Tests interoperability between CJS and ESM modules via live bindings.
 * Accessed as `api.interop.interopCjs` in the slothlet API.
 * @alias module:api_test_mixed.interop.interopCjs
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 *   console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 *   console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
 * console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
 */
const interopCjs =
	/** @lends interopCjs */
	{
		/**
		 * Tests cross-module calls between CJS and ESM with live bindings.
		 * @function testCrossCall
		 * @public
		 * @async
		 * @param {number} a - First number for testing.
		 * @param {number} b - Second number for testing.
		 * @returns {Promise<number>} Result from cross-module call.
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 *   console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test_mixed = await slothlet({ dir: './api_tests/api_test_mixed' });
		 * console.log(await api_test_mixed.interop.interopCjs.testCrossCall(2, 3)); // result
		 */
		async testCrossCall(a, b) {
			console.log("CJS Interop: Testing cross-module calls");

			// console.log(self);

			console.log(`CJS Context: User=${context.user}, Instance=${context.instanceName}`);

			// Try to call ESM math via self reference
			if (self && self.mathEsm && typeof self.mathEsm.add === "function") {
				console.log("CJS -> ESM call via self reference");
				const result = self.mathEsm.add(a, b);
				console.log(`CJS received from ESM: ${result}`);
				return result;
			} else {
				throw new Error("ESM mathEsm.add not available via self");
			}
		}
	};

module.exports = interopCjs;
