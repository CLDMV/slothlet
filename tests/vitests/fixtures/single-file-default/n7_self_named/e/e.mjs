/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/n7_self_named/e/e.mjs
 *	@Date: 2026-11-14T08:20:41-08:00 (1794673241)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:08:54-08:00 (1794676134)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file named like its folder (F04): already the folder's function.
 * @module single-file-default.n7_self_named
 */

/**
 * The file's default export.
 * @returns {string} Where it comes from.
 */
export default function run() {
	return "e/e.mjs:default";
}

/**
 * A named export.
 * @returns {string} Where it comes from.
 */
export function helper() {
	return "e/e.mjs:helper";
}
