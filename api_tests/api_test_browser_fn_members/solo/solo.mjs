/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_browser_fn_members/solo/solo.mjs
 *	@Date: 2026-11-15T12:30:32-08:00 (1794774632)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:34-08:00 (1795868854)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder's only file, named like it, with a default function and a named export called like the folder.
 * @module api_test_browser_fn_members/solo/solo
 */

/**
 * The default function.
 * @param {number} a - First factor.
 * @param {number} b - Second factor.
 * @returns {number} The product.
 */
export default function solo(a, b) {
	return a * b;
}

/**
 * Exported under the folder's name.
 * @returns {string} Its name.
 */
function solo2() {
	return "solo2";
}

export { solo2 as solo };

/** A named export called like a function's own `name`. */
export const name = "S";
