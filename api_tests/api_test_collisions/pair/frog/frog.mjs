/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/frog/frog.mjs
 *	@Date: 2026-08-03T11:44:23-07:00 (1785782663)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:27:46-07:00 (1791091666)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Self-named callable folder module exporting `_state` and `_invalid` — single-underscore
 * names that only look like framework state (that is `____state` / `____invalid`), so they compose as
 * ordinary members and must survive the collision merge.
 * @module api_test_collisions.pair.frog.frog
 * @memberof module:api_test_collisions
 */

/**
 * Folder-side callable; yields the slot to the file under the default merge.
 * @returns {string} Identifier proving which callable answered.
 * @example
 * folderFrog(); // "folder-frog"
 */
export default function folderFrog() {
	return "folder-frog";
}

/** @type {string} Ordinary member merged from the losing folder. */
export const origin = "dir";

/** @type {string} Ordinary member despite the state-like name. */
export const _state = "folder-_state";

/** @type {string} Ordinary member despite the state-like name. */
export const _invalid = "folder-_invalid";
