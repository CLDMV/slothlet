/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_folder_different/config/database.mjs
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
 * @fileoverview Database config module — config subfolder with filename different from folder name.
 * @module api_smart_flatten_folder_different.config.database
 */
/**
 * getDbConfig.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_smart_flatten_folder_different = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_folder_different' });
 * api_smart_flatten_folder_different.config.database.getDbConfig();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_smart_flatten_folder_different = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_folder_different' });
 *   api_smart_flatten_folder_different.config.database.getDbConfig();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_smart_flatten_folder_different = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_folder_different' });
 *   api_smart_flatten_folder_different.config.database.getDbConfig();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_smart_flatten_folder_different = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_folder_different' });
 * api_smart_flatten_folder_different.config.database.getDbConfig();
 */
export function getDbConfig() {
	return "database-config";
}

export const dbPort = 5432;
