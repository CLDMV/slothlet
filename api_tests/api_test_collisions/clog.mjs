/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/clog.mjs
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
 * @fileoverview Root-file half of the MULTI-FILE file+directory collision (`clog.mjs` + `clog/`
 * containing a self-named module AND a sibling). Loads FIRST, so its `level` wins the conflict
 * with `clog/clog.mjs`'s `level` under the default `merge` mode.
 * @module api_test_collisions.clog
 * @memberof module:api_test_collisions
 */

/** @type {string} Conflicting member — the directory's self-named module also exports `level`. */
export const level = "file";

/** @type {string} Non-conflicting member — only the root file provides it. */
export const origin = "file";
