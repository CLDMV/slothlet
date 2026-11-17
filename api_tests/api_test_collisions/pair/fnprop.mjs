/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/fnprop.mjs
 *	@Date: 2026-11-16T20:00:00-08:00 (1794888000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T20:00:00-08:00 (1794888000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview File side of a nested file+directory collision whose folder callable carries members
 * on its own function (`fn.tag = …`, a live getter, `fn.me = fn`) rather than as named exports. Those
 * members stay on the folder's impl, never become children of its wrapper, and are adopted onto the
 * surviving slot by the collision merge. pair/fnsolo is the same folder with no file beside it.
 * @module api_test_collisions.pair.fnprop
 * @memberof module:api_test_collisions
 */

/**
 * File-side callable; wins the slot under the default merge (first loaded).
 * @returns {string} Identifier proving the file's callable kept the slot.
 * @example
 * api.pair.fnprop(); // "file-fnprop"
 */
export default function fileFnprop() {
	return "file-fnprop";
}
