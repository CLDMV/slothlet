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
 */
export function itemA() {
	return 1;
}

/**
 * Second export.
 * @returns {number} Value 2.
 * @example
 * itemB(); // 2
 */
export function itemB() {
	return 2;
}

/**
 * Third export.
 * @returns {number} Value 3.
 * @example
 * itemC(); // 3
 */
export function itemC() {
	return 3;
}
