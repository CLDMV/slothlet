/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/p5_async/e/x.mjs
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
 * @fileoverview An async default-export function and an async named export (#773).
 * @module single-file-default.p5_async
 */

/**
 * The file's default export.
 * @returns {Promise<string>} Where it comes from.
 */
export default async function run() {
	return "e/x.mjs:default";
}

/**
 * A named export.
 * @returns {Promise<string>} Where it comes from.
 */
export async function helper() {
	return "e/x.mjs:helper";
}
