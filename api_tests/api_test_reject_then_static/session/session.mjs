/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_static/session/session.mjs
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
 * @fileoverview Fixture (#571 review): a folder's same-named file default-exports a class with a static
 * `then`. Static methods are non-enumerable, so a check that skips non-enumerable function properties
 * would accept it.
 * @module api_test_reject_then_static.session.session
 */

export default class Session {
	static then() {
		return "unreachable";
	}
	static ping() {
		return "session.ping";
	}
}
