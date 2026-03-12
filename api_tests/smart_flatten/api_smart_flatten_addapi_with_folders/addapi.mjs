/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_with_folders/addapi.mjs
 *	@Date: 2026-01-04T16:31:08-08:00 (1767573068)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-10 21:07:57 -07:00 (1773202077)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview AddApi fixture with sibling subfolders — object default with named exports.
 * Tests that the addapi eager path works correctly when the root dir also contains subfolders.
 * @module api_smart_flatten_addapi_with_folders.addapi
 */
/**
 * initializeMainPlugin.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_smart_flatten_addapi_with_folders = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_addapi_with_folders' });
 * api_smart_flatten_addapi_with_folders.addapi.initializeMainPlugin();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_smart_flatten_addapi_with_folders = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_addapi_with_folders' });
 *   api_smart_flatten_addapi_with_folders.addapi.initializeMainPlugin();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_smart_flatten_addapi_with_folders = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_addapi_with_folders' });
 *   api_smart_flatten_addapi_with_folders.addapi.initializeMainPlugin();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_smart_flatten_addapi_with_folders = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_addapi_with_folders' });
 * api_smart_flatten_addapi_with_folders.addapi.initializeMainPlugin();
 */
export function initializeMainPlugin() {
	return "Main plugin initialized from addapi.mjs";
}

/**
 * pluginGlobalMethod.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_addapi_with_folders.addapi.pluginGlobalMethod();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_addapi_with_folders.addapi.pluginGlobalMethod();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_addapi_with_folders.addapi.pluginGlobalMethod();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_addapi_with_folders.addapi.pluginGlobalMethod();
 */
export function pluginGlobalMethod() {
	return "Global plugin method from addapi.mjs";
}

export const pluginVersion = "1.0.0";
