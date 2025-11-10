/**
 * @fileoverview Internal test file for advanced self-object live-binding functionality (not exported in package.json).
 * @module api_test.advanced.selfObject
 * @memberof module:api_test
 */

import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Advanced API module for testing slothlet loader self-reference functionality.
 * Provides methods to test live-binding of self object properties.
 * @alias module:api_test.advanced.selfObject
 * @public
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
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
		 * import slothlet from "@cldmv/slothlet";
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
		 *
		 * @example // ESM usage via slothlet API (inside async function)
		 * async function example() {
		 *   const { default: slothlet } = await import("@cldmv/slothlet");
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
		 * }
		 *
		 * @example // CJS usage via slothlet API (top-level)
		 * let slothlet;
		 * (async () => {
		 *   ({ slothlet } = await import("@cldmv/slothlet"));
		 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
		 *   console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
		 * })();
		 *
		 * @example // CJS usage via slothlet API (inside async function)
		 * const slothlet = require("@cldmv/slothlet");
		 * const api_test = await slothlet({ dir: './api_tests/api_test' });
		 * console.log(await api_test.advanced.selfObject.addViaSelf(2, 3)); // 5
		 */
		addViaSelf(a, b) {
			console.log("[SELF-OBJECT DEBUG] addViaSelf called - dumping stack trace:");
			console.log(new Error().stack);
			// Direct test of instance detection
			import("@cldmv/slothlet/helpers/instance-manager")
				.then(async ({ detectCurrentInstanceId, getInstanceData }) => {
					const instanceId = detectCurrentInstanceId();
					console.log("[TEST] detectCurrentInstanceId():", instanceId);
					if (instanceId) {
						const instanceData = getInstanceData(instanceId);
						console.log("[TEST] instanceData keys:", instanceData ? Object.keys(instanceData) : "null");
						if (instanceData) {
							console.log("[TEST] instanceData.self type:", typeof instanceData.self);
							console.log("[TEST] instanceData.context type:", typeof instanceData.context);
							console.log("[TEST] instanceData.reference type:", typeof instanceData.reference);
							if (instanceData.self) {
								console.log("[TEST] instanceData.self keys:", Object.keys(instanceData.self));
							}
						}
					}
				})
				.catch(() => {
					// instance-manager not available in AsyncLocalStorage version
					console.log("[TEST] instance-manager not available (AsyncLocalStorage version)");
				});

			console.log("[TEST] === Runtime Objects Debug ===");
			console.log("[TEST] typeof self:", typeof self);
			console.log("[TEST] Object.keys(self):", Object.keys(self));
			console.log("[TEST] typeof context:", typeof context);
			console.log("[TEST] Object.keys(context):", Object.keys(context || {}));
			console.log("[TEST] typeof reference:", typeof reference);
			console.log("[TEST] Object.keys(reference):", Object.keys(reference || {}));

			if (self && self.math && typeof self.math.add === "function") {
				console.log("[TEST] About to call self.math.add with args:", a, b);
				const result = self.math.add(a, b);
				console.log("[TEST] Result from self.math.add:", result);
				return result;
			}
			console.log("[TEST] === addViaSelf function END (returning NaN) ===");
			return NaN;
		},

		/**
		 * Gets the current instance ID using the runtime system.
		 * @function getCurrentInstanceId
		 * @public
		 * @returns {string} The current instance ID
		 */
		async getCurrentInstanceId() {
			try {
				const { instanceId } = await import("@cldmv/slothlet/runtime");
				return String(instanceId);
			} catch (error) {
				return `error: ${error.message}`;
			}
		}
	};
