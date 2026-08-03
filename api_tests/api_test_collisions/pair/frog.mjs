/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/frog.mjs
 *	@Date: 2026-08-03 12:00:00 -07:00 (1785783600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-03 12:00:00 -07:00 (1785783600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview File side of a nested file+directory collision whose folder module exports members
 * that child adoption skips by its private list (`_state`, `_invalid`). Those members reach the
 * surviving slot only through the extracted snapshot — the collision merge's snapshot arm.
 * @module api_test_collisions.pair.frog
 * @memberof module:api_test_collisions
 */

/**
 * File-side callable; wins the slot under the default merge (first loaded).
 * @returns {string} Identifier proving the file's callable kept the slot.
 * @example
 * api.pair.frog(); // "file-frog"
 */
export default function fileFrog() {
	return "file-frog";
}
