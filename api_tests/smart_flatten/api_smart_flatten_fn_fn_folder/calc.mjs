/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_fn_fn_folder/calc.mjs
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
 * @fileoverview Root calc file — function default + function named export.
 *
 * Purpose: in LAZY mode with merge collision, when processSubdirectories encounters
 * the calc/ subfolder it captures the existing wrapper at targetApi["calc"]:
 *
 *   existImpl = wrapper.__impl = function calc   (typeof "function", not "object")
 *   → modes_fileFolderImpl stays null (line 1133–1134 is skipped)
 *
 *   existChildKeys = Object.keys(wrapper) = ["add"]  (add was adopted as child wrapper)
 *   → Loop fires:  if (!modes_fileFolderImpl) modes_fileFolderImpl = {}  ← line 1139
 *      modes_fileFolderImpl["add"] = wrapper["add"]
 *
 * modes_fileFolderImpl = { add: addWrapper } is then passed to createLazySubdirectoryWrapper,
 * where the nested single-file "calc/calc.mjs" has a function default → line 1409 fires.
 */

/**
 * Add two numbers.
 * @param {number} a - First operand.
 * @param {number} b - Second operand.
 * @returns {number} Sum.
 * @example
 * add(1, 2); // 3
 */
export function add(a, b) {
	return a + b;
}

/**
 * Main calc function.
 * @param {number} a - First operand.
 * @param {number} b - Second operand.
 * @returns {number} Sum.
 * @example
 * calc(1, 2); // 3
 */
function calc(a, b) {
	return a + b;
}

export default calc;
