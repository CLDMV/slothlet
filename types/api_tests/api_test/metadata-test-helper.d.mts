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
export function getMetadata(path: string): Promise<object | null>;
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
export function getSelfMetadata(): Promise<object | null>;
/**
 * Test helper that simulates a caller/callee scenario for metadataAPI.caller().
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
export function testCaller(): Promise<object>;
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
export function verifyMetadata(path: string): Promise<object>;
//# sourceMappingURL=metadata-test-helper.d.mts.map