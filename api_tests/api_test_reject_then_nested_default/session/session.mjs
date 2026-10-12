/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_nested_default/session/session.mjs
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
 * @fileoverview Fixture (#571 review): a folder's same-named file default-exports an object with an own
 * `then`. The lazy loader hands this default back as the folder's value, so the check has to run before
 * it is returned from an async function, which would otherwise call `then` and never settle.
 * @module api_test_reject_then_nested_default.session.session
 */

export default {
	then() {
		return "unreachable";
	},
	get() {
		return "session.get";
	}
};
