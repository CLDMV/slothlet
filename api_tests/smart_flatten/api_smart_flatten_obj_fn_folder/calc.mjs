/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_obj_fn_folder/calc.mjs
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
 * @fileoverview Root-level calc.mjs with OBJECT default export.
 *
 * In eager mode with collision.initial="merge":
 *   1. This file is processed first (files before directories).
 *   2. An eager wrapper is created at api.calc with impl = { add, subtract }.
 *   3. When calc/ subfolder is processed later (eager recursive subdir loop),
 *      targetApi["calc"] already holds this wrapper (modes_existingAtKey).
 *   4. Inside the collision block (lines 945-999):
 *      - modes_existingWrapper = this file's wrapper
 *      - modes_existingImpl = { add, subtract }  (typeof === "object")
 *      - implToWrap = function calc(){} from calc/calc.mjs  (typeof === "function")
 *      → Line 975 fires  (else if branch: typeof implToWrap === "function")
 *      → Lines 976-978 fire (loop copies add/subtract into implToWrap)
 *      → Line 991 may fire (modes_existingChildKeys loop, implToWrap is function) * @module api_smart_flatten_obj_fn_folder.calc */

/**
 * Adds two numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 * @example
 * add(2, 3); // 5
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
 * subtract(5, 2); // 3
 */
function subtract(a, b) {
	return a - b;
}

export default { add, subtract };
