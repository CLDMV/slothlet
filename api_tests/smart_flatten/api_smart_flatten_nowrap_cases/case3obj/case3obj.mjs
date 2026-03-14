/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_nowrap_cases/case3obj/case3obj.mjs
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
 * @fileoverview case3obj/case3obj.mjs — named export that is a plain object matching the
 * containing folder/file name, plus an extra named export.
 *
 * Used by Group 6 in modes-processor-no-wrap.test.vitest.mjs to cover Case 3
 * hasMatchingObject else-branches (lines 450, 485) inside the
 * `!isRoot && !apiPathPrefix && moduleName === categoryName` block.
 *
 * Conditions:
 *   !analysis.hasDefault
 *   moduleKeys.length > 1 AND moduleKeys includes "case3obj" (matching folder name)
 *   typeof mod["case3obj"] === "object" → hasMatchingObject=true
 *   shouldWrap=false →
 *     Line 450: assignToApiPath for each matching object property (alpha, beta)
 *     Line 485: assignToApiPath for the extra key ("extra") outside the matching object
 *
 * @module api_smart_flatten_nowrap_cases.case3obj
 * @internal
 * @private
 */

/**
 * Matching object export (same name as file/folder) — triggers hasMatchingObject branch.
 * @type {{ alpha: function, beta: function }}
 * @example
 * case3obj.alpha(); // 1
 */
export const case3obj = {
	alpha: () => 1,
	beta: () => 2
};

/**
 * Extra named export to exercise the "other keys" loop (line 485 else-branch).
 * @returns {string} A constant identifier.
 * @example
 * extra(); // "extra-value"
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.case3obj.extra();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.case3obj.extra();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_nowrap_cases.case3obj.extra();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_nowrap_cases.case3obj.extra();
 */
export function extra() {
	return "extra-value";
}
