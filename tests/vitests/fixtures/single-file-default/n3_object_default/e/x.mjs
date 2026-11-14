/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/n3_object_default/e/x.mjs
 *	@Date: 2026-11-14T08:20:40-08:00 (1794673240)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:08:53-08:00 (1794676133)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A default-export object (not a function) keeps the file's level, as in v2.11.0.
 * @module single-file-default.n3_object_default
 */

export default {
	/**
	 * A member.
	 * @returns {string} Where it comes from.
	 */
	a() {
		return "e/x.mjs:a";
	},
	/**
	 * A member.
	 * @returns {string} Where it comes from.
	 */
	b() {
		return "e/x.mjs:b";
	}
};
