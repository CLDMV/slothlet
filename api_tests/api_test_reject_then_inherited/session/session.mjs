/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_inherited/session/session.mjs
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
 * @fileoverview Fixture (#571 review): a folder's same-named file default-exports a class instance whose
 * class defines `then`. The instance inherits it, which is enough for an `await` to call it.
 * @module api_test_reject_then_inherited.session.session
 */

class Session {
	then() {
		return "unreachable";
	}
	get() {
		return "session.get";
	}
}

export default new Session();
