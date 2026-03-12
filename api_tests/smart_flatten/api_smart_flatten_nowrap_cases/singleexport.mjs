/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_nowrap_cases/singleexport.mjs
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
 * @fileoverview singleexport.mjs — single named export whose name matches the filename.
 *
 * Used by Group 6 in modes-processor-no-wrap.test.vitest.mjs to cover the
 * single-export auto-flatten else-branch (shouldWrap=false path).
 *
 * Conditions:
 *   !analysis.hasDefault  AND  moduleKeys.length === 1
 *   normalizedKey("singleExport") === normalizedModuleName("singleexport")  → auto-flatten fires
 *   shouldWrap=false  →  direct assignToApiPath instead of wrapping
 *
 * @module api_smart_flatten_nowrap_cases.singleexport
 * @internal
 * @private
 */

/**
 * Single exported function — name matches sanitized filename.
 * @returns {string} A constant result for testing.
 * @example
 * singleExport(); // "single-export-result"
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.singleexport.singleExport();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.singleexport.singleExport();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.singleexport.singleExport();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.singleexport.singleExport();
 */
export function singleExport() {
	return "single-export-result";
}
