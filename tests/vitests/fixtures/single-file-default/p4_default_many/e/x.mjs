/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/p4_default_many/e/x.mjs
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
 * @fileoverview A default-export function with several named exports, a value among them (#773).
 * @module single-file-default.p4_default_many
 */

/**
 * The file's default export.
 * @returns {string} Where it comes from.
 */
export default function run() {
	return "e/x.mjs:default";
}

/**
 * A named export.
 * @returns {string} Where it comes from.
 */
export function helper() {
	return "e/x.mjs:helper";
}

/**
 * Another named export.
 * @returns {string} Where it comes from.
 */
export function other() {
	return "e/x.mjs:other";
}

/** A named value. */
export const limit = 3;
