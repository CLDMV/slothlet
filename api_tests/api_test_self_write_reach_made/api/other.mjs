/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_write_reach_made/api/other.mjs
 *	@Date: 2026-11-15T11:38:09-08:00 (1794771489)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:47-08:00 (1795868987)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Another leaf, reading the members `maker.mjs` made on a folder.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read one member of a folder and say whether the folder lists it.
 * @param {"root"|"zz"} where - The api root, or the `zz` mount.
 * @param {string} name - The member.
 * @returns {{read: *, listed: *}} What each step gave.
 * @example
 * read("root", "baseDefined");
 */
export function read(where, name) {
	const folder = where === "root" ? self : self.zz;
	const attempt = (step) => {
		try {
			return step();
		} catch (error) {
			return { code: error?.code ?? error?.name, message: String(error?.message) };
		}
	};
	return { read: attempt(() => folder[name]), listed: attempt(() => Object.keys(folder).includes(name)) };
}
