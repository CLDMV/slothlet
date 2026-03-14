/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_conflict/config.mjs
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
 * @fileoverview Root-level config.mjs fixture for smart-flatten conflict testing.
 * Collides with the config/ subfolder to test flatten conflict resolution.
 * @module api_smart_flatten_conflict.configFile
 */
// Root-level config.mjs file
/**
 * getRootConfig.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_conflict.config.getRootConfig();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_conflict.config.getRootConfig();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_conflict.config.getRootConfig();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_conflict.config.getRootConfig();
 */
export function getRootConfig() {
	return "root-config-value";
}

/**
 * setRootConfig.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_conflict.config.setRootConfig();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_conflict.config.setRootConfig();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_conflict.config.setRootConfig();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_conflict.config.setRootConfig();
 */
export function setRootConfig() {
	return "root-config-set";
}
