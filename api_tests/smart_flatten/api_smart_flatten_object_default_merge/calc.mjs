/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_object_default_merge/calc.mjs
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
 * @fileoverview Root-level calc file with object default export.
 * Creates an eager wrapper at api.calc with impl={add, subtract}.
 * When calc/ subfolder is processed later in the eager subdir loop,
 * targetApi["calc"] is already set → triggers lines 971-978 (merge existing impl into new implToWrap).
 */

/**
 * Adds two numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 * @example
 * calc.add(2, 3); // 5
 */
function add(a, b) {
	return a + b;
}

/**
 * Subtracts b from a.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 * @example
 * calc.subtract(5, 2); // 3
 */
function subtract(a, b) {
	return a - b;
}

export default { add, subtract };
