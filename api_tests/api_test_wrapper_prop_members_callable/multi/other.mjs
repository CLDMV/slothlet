/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapper_prop_members_callable/multi/other.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T00:00:00-07:00 (1791529200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#571 review): a plain sibling, so `multi` composes through the multi-member path.
 * @module api_test_wrapper_prop_members_callable.multi.other
 */

/**
 * A sibling member.
 * @returns {string} "multi.other".
 */
export function other() {
	return "multi.other";
}
