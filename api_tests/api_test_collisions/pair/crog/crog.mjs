/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/crog/crog.mjs
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
 * @fileoverview Directory half of the CALLABLE-vs-CALLABLE collision: a self-named module whose
 * default would be the callable in isolation (F04) — but it loads SECOND, so under `merge` its
 * callable and its `origin` lose to the file's, while `mode` (non-conflicting) still composes.
 * Under `merge-replace` this callable wins the slot.
 * @module api_test_collisions.pair.crog.crog
 * @memberof module:api_test_collisions
 */

/**
 * The second-loaded callable — wins only under `merge-replace`.
 * @param {string} x - Input to tag.
 * @returns {string} Tagged output.
 * @example
 * api.pair.crog("x"); // "crog:x" (merge-replace only)
 */
export default function crog(x) {
	return `crog:${x}`;
}

/** @type {string} Conflicting member — the file also exports `origin` and wins under merge. */
export const origin = "dir";

/** @type {string} Non-conflicting member — added under every merge flavour. */
export const mode = "dir";
