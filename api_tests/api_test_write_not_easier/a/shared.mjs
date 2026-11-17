/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_write_not_easier/a/shared.mjs
 *	@Date: 2026-11-17T07:36:48-08:00 (1794929808)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:55:49-08:00 (1794930949)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The first module mounted at `p`: the members the second module, mounted at the same point, tries to
 * call and to replace.
 */

/**
 * Answer who answered.
 * @returns {string} `"a"`.
 * @example
 * who(); // "a"
 */
export function who() {
	return "a";
}

/**
 * A data value of the first module's.
 * @type {number}
 */
export const count = 1;

/**
 * A class of the first module's, whose prototype method the second module tries to replace.
 */
export class Box {
	/**
	 * Name the box.
	 * @returns {string} `"a-box"`.
	 * @example
	 * new Box().label(); // "a-box"
	 */
	label() {
		return "a-box";
	}
}
