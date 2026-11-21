/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inherited_members/obj.mjs
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
 * @fileoverview Inherited-member fixture (#630). Composes `api.obj` from two named exports: an object node
 * (`box`) and a callable node carrying a child (`named`).
 * @module api_test_inherited_members/obj
 */

/** A plain object export. */
export const box = { marker: 1, inner: { v: 2 } };

/**
 * A function export with a child of its own.
 * @returns {string} Its name.
 */
export function named() {
	return "named";
}
named.child = { c: 3 };
