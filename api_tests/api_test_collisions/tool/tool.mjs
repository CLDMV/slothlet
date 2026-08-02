/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/tool/tool.mjs
 *	@Date: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Directory half of the SINGLE-FILE collision: a self-named module whose default
 * function becomes the callable at the folder's path (F04/C10). Loads SECOND, so under `merge` it
 * contributes the callable and any non-conflicting members, but its `level` loses to the root
 * file's.
 * @module api_test_collisions.tool.tool
 * @memberof module:api_test_collisions
 */

/**
 * The callable the collision slot must expose.
 * @param {string} x - Input to tag.
 * @returns {string} Tagged output.
 * @example
 * api.tool("x"); // "tool:x"
 */
export default function tool(x) {
	return `tool:${x}`;
}

/** @type {string} Conflicting member — the root file also exports `level` and wins (first loaded). */
export const level = "dir";
