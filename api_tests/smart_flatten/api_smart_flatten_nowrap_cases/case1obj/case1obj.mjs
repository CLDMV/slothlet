/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_nowrap_cases/case1obj/case1obj.mjs
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
 * @fileoverview case1obj/case1obj.mjs — single named export that is a plain object, matching
 * both the file name and the containing folder name.
 *
 * Used by Group 6 in modes-processor-no-wrap.test.vitest.mjs to cover Case 1 else-branch
 * (shouldWrap=false path) inside the `!isRoot && !apiPathPrefix && moduleName === categoryName`
 * block.
 *
 * Conditions:
 *   !analysis.hasDefault
 *   moduleKeys.length === 1  AND  moduleKeys[0] === moduleName ("case1obj")
 *   typeof exportedValue === "object"  →  Case 1 fires
 *   shouldWrap=false  →  debug statement at the else-branch fires instead of UnifiedWrapper
 *
 * @module api_tests/smart_flatten/api_smart_flatten_nowrap_cases/case1obj/case1obj
 * @internal
 * @private
 */

/**
 * Plain object exported as same name as the file/folder — triggers Case 1 wrap path.
 * @type {{ value: number, label: string }}
 * @example
 * case1obj.value // 42
 */
export const case1obj = {
	value: 42,
	label: "case1-object-fixture"
};
