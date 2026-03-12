/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_nowrap_cases/multiexport/multiexport.mjs
 *	@Date: 2026-03-02T20:00:00-08:00 (1772517600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 20:00:00 -08:00 (1772517600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview multiexport/multiexport.mjs — multiple named exports, no default, matching
 * the containing folder name.
 *
 * Used by Group 6 to cover Case 3 else-branches (shouldWrap=false path) inside the
 * `!isRoot && !apiPathPrefix && moduleName === categoryName` block.
 *
 * Conditions:
 *   !analysis.hasDefault  AND  moduleKeys.length > 1  AND  moduleName === categoryName
 *   → Case 3 ("Regular multi-export" sub-path) fires
 *   shouldWrap=false  →  direct assignToApiPath for each key instead of wrapping
 *
 * @module api_smart_flatten_nowrap_cases.multiexport
 * @internal
 * @private
 */

/**
 * First export.
 * @returns {number} Value 1.
 * @example
 * itemA(); // 1
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemA();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemA();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemA();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemA();
 */
export function itemA() {
	return 1;
}

/**
 * Second export.
 * @returns {number} Value 2.
 * @example
 * itemB(); // 2
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemB();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemB();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemB();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemB();
 */
export function itemB() {
	return 2;
}

/**
 * Third export.
 * @returns {number} Value 3.
 * @example
 * itemC(); // 3
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemC();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemC();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemC();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.multiexport.itemC();
 */
export function itemC() {
	return 3;
}
