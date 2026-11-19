/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permission_levels/base/cache.mjs
 *	@Date: 2026-11-18T09:00:00-08:00 (1795021200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T09:00:00-08:00 (1795021200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base module's cache: two data members and a function, which another module calls, reads and
 * writes under the permission rule levels.
 */

/**
 * A data member.
 * @type {number}
 */
export const key = 1;

/**
 * Another data member, beside `key`.
 * @type {number}
 */
export const other = 2;

/**
 * A function member.
 * @returns {string} `"fn"`.
 * @example
 * fn(); // "fn"
 */
export function fn() {
	return "fn";
}
