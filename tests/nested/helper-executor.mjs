/**
 * @fileoverview Helper executor in nested directory for path resolution testing
 * @module nested/helper-executor
 * @description
 * This file exists in a nested directory (tests/nested/) to test that addApi
 * resolves paths correctly even when called through a function in a different directory.
 * The path resolution should be relative to where addApi was DEFINED (the test file),
 * not where this executor is located.
 */

/**
 * Execute a function with the provided API instance
 * This is intentionally in a nested directory to test path resolution
 * @param {object} api - Slothlet API instance
 * @param {Function} fn - Function to execute with the API
 * @returns {Promise<any>} Result of the function execution
 */
export async function executeWithApi(api, fn) {
	return await fn(api);
}

/**
 * Execute addApi through this nested helper
 * @param {object} api - Slothlet API instance
 * @param {string} apiPath - API path
 * @param {string} folderPath - Folder path (relative to caller, not this file)
 * @param {object} metadata - Metadata object
 * @param {object} options - Options object
 * @returns {Promise<void>}
 */
export async function addApiFromNested(api, apiPath, folderPath, metadata = {}, options = {}) {
	return await api.addApi(apiPath, folderPath, metadata, options);
}
