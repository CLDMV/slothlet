/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_object_default_merge/calc/calc.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772467200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 16:10:29 -08:00 (1772496629)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Inner calc/calc.mjs with object default export (divide, multiply).
 * Triggers the eager single-file folder flatten path (filenameMatchesFolder=true).
 * The modes_existingAtKey check merges the root calc.mjs impl (add, subtract)
 * into this folder's implToWrap (divide, multiply) — lines 971-978 in modes-processor.mjs.
 * @module api_smart_flatten_object_default_merge.calc.calc
 */

/**
 * Divides a by b.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 * @example
 * calc.divide(6, 2); // 3
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_object_default_merge.calc.divide(1, 1);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_object_default_merge.calc.divide(1, 1);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_object_default_merge.calc.divide(1, 1);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_object_default_merge.calc.divide(1, 1);
 */
function divide(a, b) {
	return a / b;
}

/**
 * Multiplies a and b.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 * @example
 * calc.multiply(2, 3); // 6
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_object_default_merge.calc.multiply(1, 1);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_object_default_merge.calc.multiply(1, 1);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_object_default_merge.calc.multiply(1, 1);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_object_default_merge.calc.multiply(1, 1);
 */
function multiply(a, b) {
	return a * b;
}

export default { divide, multiply };
