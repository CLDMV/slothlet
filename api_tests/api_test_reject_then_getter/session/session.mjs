/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_getter/session/session.mjs
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
 * @fileoverview Fixture (#571 review): a folder's same-named file default-exports an object whose own
 * `then` is a getter. The name is refused without running the getter, which would throw.
 * @module api_test_reject_then_getter.session.session
 */

export default {
	/** @returns {never} Throws if read. */
	get then() {
		throw new Error("then getter ran");
	},
	/** @returns {string} Marker. */
	get() {
		return "session.get";
	}
};
