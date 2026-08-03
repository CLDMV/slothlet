/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_underscore/mod/mod.mjs
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
 * @fileoverview Exports whose names begin with `_` / `__`. The documented hidden-entry rule covers
 * FILE and FOLDER names, not export names, so these are ordinary api members and must compose
 * identically in both modes. (A module-private meaning for the prefix is proposed in #260; until
 * that lands the members are simply public — but they must never silently vanish.)
 * @module api_test_underscore.mod
 * @memberof module:api_test_underscore
 */

/** @type {string} Double-underscore export — an api member, not framework metadata. */
export const __priv = "p";

/** @type {string} Single-underscore export — same. */
export const _semi = "s";

/** @type {string} Ordinary control member. */
export const plain = "ok";
