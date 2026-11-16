/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/p1_issue/e/x.mjs
 *	@Date: 2026-11-14T08:20:39-08:00 (1794673239)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:08:55-08:00 (1794676135)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The folder's only file: a default-export function of another name and a named export (#773).
 * @module single-file-default.p1_issue
 */

/**
 * The file's default export.
 * @returns {string} Where it comes from.
 */
export default function run() {
	return "e/x.mjs:default";
}

/**
 * A named export beside the default.
 * @returns {string} Where it comes from.
 */
export function helper() {
	return "e/x.mjs:helper";
}
