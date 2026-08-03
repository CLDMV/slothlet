/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/tool.mjs
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
 * @fileoverview Root-file half of the SINGLE-FILE file+directory collision (`tool.mjs` + `tool/`).
 * Loads FIRST (files before directories), so under the default `merge` collision mode its members
 * win conflicts: `api.tool.level === "file"` even though `tool/tool.mjs` also exports `level`.
 * @module api_test_collisions.tool
 * @memberof module:api_test_collisions
 */

/** @type {string} Conflicting member — the directory's module also exports `level`. */
export const level = "file";

/** @type {string} Non-conflicting member — only the root file provides it. */
export const origin = "file";
