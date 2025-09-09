/**
 * @fileoverview Internal test file for advanced self-object live-binding functionality (not exported in package.json).
 * @module api_test.advanced.selfObject
 * @memberof module:api_test
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Advanced API module for testing slothlet loader self-reference functionality.
 * Provides methods to test live-binding of self object properties.
 * @alias module:api_test.advanced.selfObject
 * @public
 *
 * @example // ESM usage via slothlet API
 * import slothlet from '@cldmv/slothlet';
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import('@cldmv/slothlet');
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require('@cldmv/slothlet');
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
 */
export const selfObject =
	/** @lends selfObject */
	{
		/**
		 * Adds two numbers using live-binding through self.math.add reference.
		 * Tests that self-references work correctly in the slothlet loader system.
		 * @function addViaSelf
		 * @public
		 *
		 * @param {number} a - The first number to add.
		 * @param {number} b - The second number to add.
		 * @returns {number} The sum of a and b, or NaN if self.math.add is not available.
		 *
		 * @example // ESM usage via slothlet API
		 * import slothlet from '@cldmv/slothlet';
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import('@cldmv/slothlet');
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import('@cldmv/slothlet'));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require('@cldmv/slothlet');
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
		 */
		addViaSelf(a, b) {
			// console.log("[TEST] === addViaSelf function START ===");
			// console.log("[TEST] Function called with arguments.length:", arguments.length);
			// console.log("[TEST] Function called with arguments:", Array.from(arguments));
			// console.log("[TEST] Function called with a:", a, "b:", b);
			// console.log("[TEST] === checking self.math.add ===");
			// console.log("[TEST] typeof self:", typeof self);
			// console.log("[TEST] typeof self.math:", typeof self.math);
			// console.log("[TEST] typeof self.math.add:", typeof self.math.add);
			// console.log("[TEST] self.math.add function:", self.math.add);
			// console.log("[TEST] self.math.add.toString():", self.math.add ? self.math.add.toString() : "undefined");

			if (self && self.math && typeof self.math.add === "function") {
				// console.log("[TEST] About to call self.math.add with args:", a, b);
				const result = self.math.add(a, b);
				// console.log("[TEST] Result from self.math.add:", result);
				return result;
			}
			// console.log("[TEST] === addViaSelf function END (returning NaN) ===");
			return NaN;
		}
	};
