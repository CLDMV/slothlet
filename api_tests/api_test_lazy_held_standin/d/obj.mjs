/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_held_standin/d/obj.mjs
 *	@Date: 2026-11-15T08:35:27-08:00 (1794760527)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:38:59-08:00 (1794775139)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/** A default-export object of data and a method. */
export default {
	a: 1,
	b: "two",
	f() {
		return "f:" + this.a;
	}
};
