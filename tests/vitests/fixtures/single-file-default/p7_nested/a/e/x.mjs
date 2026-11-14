/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/p7_nested/a/e/x.mjs
 *	@Date: 2026-11-14T08:20:39-08:00 (1794673239)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:08:56-08:00 (1794676136)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The single-file folder one level down: `a/e/x.mjs` (#773).
 * @module single-file-default.p7_nested
 */

/**
 * The file's default export.
 * @returns {string} Where it comes from.
 */
export default function run() {
	return "a/e/x.mjs:default";
}

/**
 * A named export.
 * @returns {string} Where it comes from.
 */
export function helper() {
	return "a/e/x.mjs:helper";
}
