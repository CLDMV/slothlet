/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_browser_fn_members/own/own.mjs
 *	@Date: 2026-11-15T12:30:32-08:00 (1794774632)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:33-08:00 (1795868853)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A default function holding a member the module put on it, beside a named export of the same name.
 * @module api_test_browser_fn_members/own/own
 */

/**
 * The default function.
 * @returns {string} Its name.
 */
function own() {
	return "own";
}
own.tag = "own-tag";

export default own;

/** A named export called like the function's own member. */
export const tag = "named-tag";
