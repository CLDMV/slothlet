/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inherited_members/callable/callable.mjs
 *	@Date: 2026-11-04T21:15:39-08:00 (1793855739)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:25:42-08:00 (1793859942)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Callable default of the `callable` folder (#630): `api.callable` is this function, with the
 * folder's other files as its children.
 * @module api_test_inherited_members/callable/callable
 */

/**
 * Join its arguments.
 * @param {string} a - First part.
 * @param {string} b - Second part.
 * @returns {string} The joined parts.
 */
export default function callable(a, b) {
	return `callable:${a}${b}`;
}
