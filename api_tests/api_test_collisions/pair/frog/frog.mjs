/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/frog/frog.mjs
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
 * @fileoverview Self-named callable folder module exporting `_state` and `_invalid` — names child
 * adoption's private skip list holds but the framework does NOT reserve, so they stay on the impl
 * and reach the merged slot only via the extracted snapshot.
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

/** @type {string} Adoption-skipped member; must still compose as an api member. */
export const _state = "folder-_state";

/** @type {string} Adoption-skipped member; must still compose as an api member. */
export const _invalid = "folder-_invalid";
