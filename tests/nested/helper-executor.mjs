/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/nested/helper-executor.mjs
 *	@Date: 2026-01-04T16:31:08-08:00 (1767573068)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:41 -08:00 (1770266381)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Helper executor in nested directory for path resolution testing
 * @module nested/helper-executor
 * @description
 * This file exists in a nested directory (tests/nested/) to test that api.slothlet.api.add
 * resolves paths correctly even when called through a function in a different directory.
 * The path resolution should be relative to where api.slothlet.api.add was DEFINED (the test file),
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
 * Execute api.slothlet.api.add through this nested helper
 * @param {object} api - Slothlet API instance
 * @param {string} apiPath - API path
 * @param {string} folderPath - Folder path (relative to caller, not this file)
 * @param {object} options - Options object
 * @returns {Promise<void>}
 */
export async function addApiFromNested(api, apiPath, folderPath, options = {}) {
	return await api.slothlet.api.add(apiPath, folderPath, options);
}
