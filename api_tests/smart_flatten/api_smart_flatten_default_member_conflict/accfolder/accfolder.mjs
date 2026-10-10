/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_default_member_conflict/accfolder/accfolder.mjs
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
 * @fileoverview Fixture (#585 review): accessor.mjs as a folder's same-named file.
 * @module api_smart_flatten_default_member_conflict.accfolder.accfolder
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
