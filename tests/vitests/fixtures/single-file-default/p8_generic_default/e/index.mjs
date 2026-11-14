/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/p8_generic_default/e/index.mjs
 *	@Date: 2026-11-14T08:20:40-08:00 (1794673240)
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
 * @fileoverview A generic entry name holding a named default-export function and a named export (#773).
 * @module single-file-default.p8_generic_default
 */

/**
 * The file's default export.
 * @returns {string} Where it comes from.
 */
export default function run() {
	return "e/index.mjs:default";
}

/**
 * A named export.
 * @returns {string} Where it comes from.
 */
export function helper() {
	return "e/index.mjs:helper";
}
