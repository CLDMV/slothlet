/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_inherited_file/session/store.mjs
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
 * @fileoverview Fixture (#571 review): a file in a folder default-exports a class instance whose
 * class defines `then`. The instance inherits it, which is enough for an `await` to call it.
 * @module api_test_reject_then_inherited_file.session.store
 */

class Store {
	then() {
		return "unreachable";
	}
	get() {
		return "session.store.get";
	}
}

export default new Store();
