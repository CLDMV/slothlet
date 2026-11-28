/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_collisions/pair/frog.mjs
 *	@Date: 2026-08-03T11:44:23-07:00 (1785782663)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:50-08:00 (1795868870)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview File side of a nested file+directory collision whose folder module exports `_state`
 * and `_invalid`. Those are ordinary export names (the framework's own state is `____state` /
 * `____invalid`), so they are adopted as children and reach the surviving slot through the ordinary
 * child merge, in both modes.
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
