/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_file_folder_merge/calc.mjs
 *	@Date: 2026-11-25T12:17:46-08:00 (1795637866)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T12:23:04-08:00 (1795638184)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview File side of a file+directory collision with no default export. Loads before the
 * folder of the same name, so under `merge` it wins every conflicting member, nested ones included.
 * @module api_test_file_folder_merge.calc
 * @memberof module:api_test_file_folder_merge
 */

/** @type {string} Conflicts with the folder's `version`; the file's value is kept under merge. */
export const version = "file";

/** @type {{a: string}} Conflicts with the folder's `inner`; merges with it, the file's `a` kept. */
export const inner = { a: "file" };

/**
 * File-only member.
 * @returns {string} Marker proving the file's member survived the merge.
 * @example
 * api.calc.add(); // "file-add"
 */
export function add() {
	return "file-add";
}
