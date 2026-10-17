/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_addapi/session/addapi.mjs
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
 * @fileoverview Fixture (#571 review): a folder's `addapi` file default-exports an object with an own
 * `then`. Its members become the folder's own members, so `then` would be an unreachable member (eager)
 * or make the lazy folder thenable and leave it loading forever.
 * @module api_test_reject_then_addapi.session.addapi
 */

export default {
	then() {
		return "unreachable";
	},
	get() {
		return "session.get";
	}
};
