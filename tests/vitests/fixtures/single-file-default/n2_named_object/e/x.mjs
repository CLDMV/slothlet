/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/n2_named_object/e/x.mjs
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
 * @fileoverview No default export: a named object named like the file keeps the file's level.
 * @module single-file-default.n2_named_object
 */

/** The file's only export. */
export const x = {
	/**
	 * A member.
	 * @returns {string} Where it comes from.
	 */
	a() {
		return "e/x.mjs:x.a";
	},
	/**
	 * A member.
	 * @returns {string} Where it comes from.
	 */
	b() {
		return "e/x.mjs:x.b";
	}
};
