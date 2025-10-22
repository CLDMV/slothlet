/**
 * @fileoverview Advanced self-object module (CJS version) for testing live-binding functionality. Internal file (not exported in package.json).
 * @module api_test_cjs.advanced.selfObject
 * @memberof module:api_test_cjs
 */

// Get live bindings from runtime
let self, context;
(async () => {
	({ self, context } = await import("@cldmv/slothlet/runtime"));
})();

/**
 * Advanced self-object API for testing CJS live-binding functionality.
 * Accessed as `api.advanced.selfObject` in the slothlet API.
 * @alias module:api_test_cjs.advanced.selfObject
 * @public
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 *   console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
 * console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
 */
const selfObject =
	/** @lends selfObject */
	{
		/**
		 * Returns the result of self.math.add(a, b) using live-binding via runtime import.
		 * Adds two numbers.
		 * @function addViaSelf
		 * @public
		 * @param {number} a - First number to add
		 * @param {number} b - Second number to add
		 * @returns {number} Sum of a and b via self reference
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 * console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 *   console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test_cjs = await slothlet({ dir: './api_tests/api_test_cjs' });
		 * console.log(api_test_cjs.advanced.selfObject.addViaSelf(2, 3)); // 5
		 */
		async addViaSelf(a, b) {
			console.log("CJS Self-Reference Test:");
			console.log("Context user:", context.user);
			console.log("Self available:", !!self);
			console.log("Self.math available:", !!self.math);

			if (self && typeof self.math?.add === "function") {
				return self.math.add(a, b);
			}
			throw new Error("self.math.add is not available");
		}
	};

module.exports = selfObject;
