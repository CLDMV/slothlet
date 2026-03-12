/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_fn_fn_folder/calc/calc.mjs
 *	@Date: 2026-03-02T19:00:00-08:00 (1772514000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 19:00:00 -08:00 (1772514000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview calc/calc.mjs — single file in subfolder (filenameMatchesFolder=true).
 *
 * Purpose: triggers lines 1330 and 1409-1411 inside createLazySubdirectoryWrapper.
 *
 * Line 1330 (shouldAttachNamedExport=false continue in hybrid pattern):
 *   moduleKeys = ["calc"]  (function, not filtered by primitive check)
 *   implToWrap = exports.default = calc  (from `else if (exports.default !== undefined)`)
 *   Hybrid pattern loop: key = "calc"
 *     shouldAttachNamedExport("calc", calc, calc, calc)
 *       → value === originalDefault (calc === calc) → returns false
 *       → !false = true → continue at line 1330
 *
 * Line 1409-1411 (file-folder collision with function implToWrap):
 *   fileFolderCollisionImpl = { add: addWrapper }  (captured from root calc.mjs wrapper)
 *   typeof implToWrap === "function"               (calc is a function)
 *   → else if branch at 1409 fires
 *   → loop over fileFolderCollisionImpl entries    (lines 1410-1411)
 * @module api_smart_flatten_fn_fn_folder.calc.calc
 */

/**
 * Nested calc function (subfolder implementation).
 * @param {number} a - First operand.
 * @param {number} b - Second operand.
 * @returns {number} Sum.
 * @example
 * calc(2, 3); // 5
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_fn_fn_folder.calc.calc(1, 1);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_fn_fn_folder.calc.calc(1, 1);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_fn_fn_folder.calc.calc(1, 1);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_fn_fn_folder.calc.calc(1, 1);
 */
function calc(a, b) {
	return a + b;
}

// Named export that is the same reference as the default.
// This causes shouldAttachNamedExport to return false, triggering line 1330.
export { calc };
export default calc;
