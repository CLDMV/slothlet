/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_object_default_merge/calc/calc.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772467200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 00:00:00 -08:00 (1772467200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Momentum Inc. All rights reserved.
 */

/**
 * @fileoverview Inner calc/calc.mjs with object default export (divide, multiply).
 * Triggers the eager single-file folder flatten path (filenameMatchesFolder=true).
 * The modes_existingAtKey check merges the root calc.mjs impl (add, subtract)
 * into this folder's implToWrap (divide, multiply) — lines 971-978 in modes-processor.mjs.
 */

/**
 * Divides a by b.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 * @example
 * calc.divide(6, 2); // 3
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
 */
function multiply(a, b) {
	return a * b;
}

export default { divide, multiply };
