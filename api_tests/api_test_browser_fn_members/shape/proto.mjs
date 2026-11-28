/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_browser_fn_members/shape/proto.mjs
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
 * @fileoverview A default function beside a named export called `prototype`.
 * @module api_test_browser_fn_members/shape/proto
 */

/**
 * The default function.
 * @returns {number} One.
 */
export default function proto() {
	return 1;
}

/** A named export called like a function's own `prototype`. */
export const prototype = "P";

/** A plain named export. */
export const tag = "t";
