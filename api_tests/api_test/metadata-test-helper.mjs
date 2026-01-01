/**
 * @fileoverview Helper functions for testing metadataAPI from within slothlet context.
 * @module api_test.metadataTestHelper
 * @memberof module:api_test
 * @public
 *
 * @description
 * Provides test helper functions that access metadataAPI from within the slothlet
 * execution context where runtime bindings (self, context, reference) are available.
 */

// Import runtime bindings - these establish the execution context

import { self as _, metadataAPI } from "@cldmv/slothlet/runtime";

/**
 * Test helper that calls metadataAPI.get() from within slothlet context.
 *
 * @function getMetadata
 * @public
 * @param {string} path - Dot-notation path to function
 * @returns {Promise<object|null>} Metadata object or null
 *
 * @description
 * This function runs inside the slothlet API context where runtime.self
 * is available, allowing metadataAPI.get() to access the API root.
 *
 * @example
 * // From test file
 * const meta = await api.metadataTestHelper.getMetadata("plugins.mathEsm.add");
 */
export async function getMetadata(path) {
	const result = await metadataAPI.get(path);
	// Debug: Show what we got
	if (process.env.SLOTHLET_DEBUG) {
		console.log("[getMetadata] Result for", path, ":", result);
	}
	return result;
}

/**
 * Test helper that calls metadataAPI.self() from within slothlet context.
 *
 * @function getSelfMetadata
 * @public
 * @returns {Promise<object|null>} This function's metadata or null
 *
 * @description
 * Returns the metadata of this helper function itself, demonstrating
 * that metadataAPI.self() works within the slothlet context.
 *
 * @example
 * // From test file
 * const meta = await api.metadataTestHelper.getSelfMetadata();
 */
export async function getSelfMetadata() {
	return await metadataAPI.self();
}

/**
 * Test helper that simulates a caller detection scenario for metadataAPI.caller().
 *
 * @function testCaller
 * @public
 * @returns {Promise<object>} Object with caller metadata and test results
 *
 * @description
 * This function calls an inner function which checks its caller's metadata
 * using metadataAPI.caller(). Used to test the caller tracking functionality.
 *
 * @example
 * // From test file
 * const result = await api.metadataTestHelper.testCaller();
 * console.log(result.callerMeta); // Should show testCaller's metadata
 */
export async function testCaller() {
	// Inner function that will check who called it
	async function innerFunction() {
		const callerMeta = await metadataAPI.caller();
		return { callerMeta };
	}

	// Call inner function - it should see testCaller as the caller
	return await innerFunction();
}

/**
 * Helper to verify a function exists and has metadata.
 *
 * @function verifyMetadata
 * @public
 * @param {string} path - Dot-notation path to function
 * @returns {Promise<object>} Verification results
 *
 * @description
 * Checks if a function exists and has the expected metadata properties.
 *
 * @example
 * // From test file
 * const result = await api.metadataTestHelper.verifyMetadata("plugins.mathEsm.add");
 */
export async function verifyMetadata(path) {
	const meta = await metadataAPI.get(path);
	return {
		exists: meta !== null,
		hasSourceFolder: meta?.sourceFolder !== undefined,
		metadata: meta
	};
}
