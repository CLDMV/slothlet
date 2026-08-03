/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/crog.mjs
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
 * @fileoverview File half of the CALLABLE-vs-CALLABLE collision, nested so the default function
 * composes at `api.pair.crog` (a base-root default-fn file would become a root contributor
 * instead). Loads FIRST: under the default `merge` its callable and its `origin` win.
 * @module api_test_collisions.pair.crog
 * @memberof module:api_test_collisions
 */

/**
 * The first-loaded callable — under `merge` it keeps the slot.
 * @returns {string} Tag proving which callable answered.
 * @example
 * api.pair.crog(); // "file-crog"
 */
export default function fileCrog() {
	return "file-crog";
}

/** @type {string} Conflicting member — the directory's module also exports `origin`. */
export const origin = "file";
