/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_construct/user/user.mjs
 *	@Date: 2026-11-01T09:37:45-08:00 (1793554665)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T10:20:34-08:00 (1793557234)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Construct the lazy folder's class through `self` before it has loaded.
 * @param {*} x - Passed to the constructor.
 * @returns {Promise<string>} What the instance says.
 */
export async function make(x) {
	const made = await new self.lz.deep.Maker(x);
	return made.say();
}
