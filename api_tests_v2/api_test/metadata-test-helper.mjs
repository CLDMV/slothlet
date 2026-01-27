/**
 * @fileoverview Helper functions for testing metadata API from within slothlet context.
 * @module api_test.metadataTestHelper
 * @memberof module:api_test
 * @public
 *
 * @description
 * Provides test helper functions that access metadata API from within the slothlet
 * execution context where runtime bindings (self, context, reference) are available.
 */

// Import runtime bindings - these establish the execution context
import { self } from "@cldmv/slothlet/runtime";

console.log("[metadata-test-helper] Module loaded at:", new Date().toISOString());

/**
 * Test helper that calls api.slothlet.metadata.get() from within slothlet context.
 *
 * @function getMetadata
 * @public
 * @param {string} path - Dot-notation path to function
 * @returns {Promise<object|null>} Metadata object or null
 *
 * @description
 * This function runs inside the slothlet API context where runtime.self
 * is available, allowing metadata.get() to access the API root.
 *
 * @example
 * // From test file
 * const meta = await api.metadataTestHelper.getMetadata("plugins.mathEsm.add");
 */
export async function getMetadata(path) {
	// Access metadata API through self (the bound API root)
	if (!self.slothlet?.metadata?.get) {
		throw new Error("Metadata API not available - ensure slothlet instance has metadata enabled");
	}

	const result = await self.slothlet.metadata.get(path);

	// Debug: Show what we got
	if (process.env.SLOTHLET_DEBUG) {
		console.log("[getMetadata] Result for", path, ":", result);
		console.log("[getMetadata] Converting null?", result === null);
	}

	// Convert null to undefined for test consistency
	const finalResult = result === null ? undefined : result;

	if (process.env.SLOTHLET_DEBUG) {
		console.log("[getMetadata] Final result:", finalResult);
	}

	return finalResult;
}

/**
 * Test helper that calls api.slothlet.metadata.self() from within slothlet context.
 *
 * @function getSelfMetadata
 * @public
 * @returns {Promise<object|null>} This function's metadata or null
 *
 * @description
 * Returns the metadata of this helper function itself, demonstrating
 * that metadata.self() works within the slothlet context.
 *
 * @example
 * // From test file
 * const meta = await api.metadataTestHelper.getSelfMetadata();
 */
export async function getSelfMetadata() {
	// Access metadata API through self (the bound API root)
	if (!self.slothlet?.metadata?.self) {
		throw new Error("Metadata API not available - ensure slothlet instance has metadata enabled");
	}

	return self.slothlet.metadata.self();
}

/**
 * Test helper that simulates a caller detection scenario for api.slothlet.metadata.caller().
 *
 * @function testCaller
 * @public
 * @returns {Promise<object>} Object with caller metadata and test results
 *
 * @description
 * This function calls an inner function which checks its caller's metadata
 * using metadata.caller(). Used to test the caller tracking functionality.
 *
 * @example
 * // From test file
 * const result = await api.metadataTestHelper.testCaller();
 * console.log(result.callerMeta); // Should show testCaller's metadata
 */
export async function testCaller() {
	// Access metadata API through self (the bound API root)
	if (!self.slothlet?.metadata?.caller) {
		throw new Error("Metadata API not available - ensure slothlet instance has metadata enabled");
	}

	// Inner function that will check who called it
	async function innerFunction() {
		const callerMeta = self.slothlet.metadata.caller();
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
	// Access metadata API through self (the bound API root)
	if (!self.slothlet?.metadata?.get) {
		throw new Error("Metadata API not available - ensure slothlet instance has metadata enabled");
	}

	const meta = await self.slothlet.metadata.get(path);
	return {
		exists: meta !== null,
		hasSourceFolder: meta?.sourceFolder !== undefined,
		metadata: meta
	};
}
