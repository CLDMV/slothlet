/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_default_member_conflict/accessor.mjs
 *	@Date: 2026-10-10T09:38:42-07:00 (1791650322)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-10T09:38:42-07:00 (1791650322)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an object default whose `mode` is an accessor with a setter that
 * ignores writes, and a named export `mode` that conflicts with it.
 * @module api_smart_flatten_default_member_conflict.accessor
 */

export default {
	get mode() {
		return "default.mode";
	},
	set mode(_value) {
		// Ignores writes, so assigning a winning named export through it would leave the default's answer.
	}
};

/** Conflicts with the default's `mode` accessor. */
export const mode = "named.mode";
