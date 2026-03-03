/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_subfolder/addapi/addapi.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772467200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 16:10:27 -08:00 (1772496627)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview addapi.mjs inside an addapi/ subfolder — triggers addapi-metadata-default path
 * in the eager subdir single-file folder loop (lines 874-877 in modes-processor.mjs).
 *
 * The directory layout:
 *   api_smart_flatten_addapi_subfolder/
 *     addapi/
 *       addapi.mjs   ← this file (filenameMatchesFolder=true: "addapi"==="addapi")
 *
 * The default export is a metadata object (not the actual API).
 * Named exports are the real API functions.
 * This triggers flattenType === "addapi-metadata-default" → lines 862-877.
 */

/**
 * Plugin metadata object (the "metadata default" export for addapi pattern).
 * @type {{ name: string, version: string }}
 */
export default {
	name: "test-plugin",
	version: "1.0.0"
};

/**
 * Initializes the plugin.
 * @returns {string} Initialization result.
 * @example
 * init(); // "plugin-initialized"
 */
export function init() {
	return "plugin-initialized";
}

/**
 * Runs the plugin.
 * @returns {string} Run result.
 * @example
 * run(); // "plugin-running"
 */
export function run() {
	return "plugin-running";
}
