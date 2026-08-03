/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/clog/clog.mjs
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
 * @fileoverview Self-named module of the MULTI-FILE collision directory: its default function is
 * the callable at `api.clog` (Case-2 hoist) and its `level` loses the conflict to the root file's
 * under `merge` (first loaded wins).
 * @module api_test_collisions.clog.clog
 * @memberof module:api_test_collisions
 */

/**
 * The callable the collision slot must expose.
 * @param {string} x - Input to tag.
 * @returns {string} Tagged output.
 * @example
 * api.clog("x"); // "clog:x"
 */
export default function clog(x) {
	return `clog:${x}`;
}

/** @type {string} Conflicting member — the root file also exports `level` and wins (first loaded). */
export const level = "dir";
