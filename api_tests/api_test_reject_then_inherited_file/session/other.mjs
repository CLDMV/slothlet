/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_inherited_file/session/other.mjs
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
 * @fileoverview Fixture (#571 review): a sibling that keeps `session` a namespace.
 * @module api_test_reject_then_inherited_file.session.other
 */

/**
 * A member that loads normally.
 * @returns {string} "session.other".
 */
export function other() {
	return "session.other";
}
