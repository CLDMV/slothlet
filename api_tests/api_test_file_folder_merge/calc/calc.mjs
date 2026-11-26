/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_file_folder_merge/calc/calc.mjs
 *	@Date: 2026-11-25T12:17:49-08:00 (1795637869)
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
 * @fileoverview Folder side of a file+directory collision: the self-named file, flattened onto the
 * folder's node. Loads after the file of the same name. The folder holds this one file, so the collision composes through the single-file path.
 * @module api_test_file_folder_merge.calc.calc
 * @memberof module:api_test_file_folder_merge
 */

/** @type {string} Conflicts with the file's `version`. */
export const version = "dir";

/** @type {{a: string, b: string}} Conflicts with the file's `inner`; `b` is the folder's own. */
export const inner = { a: "dir", b: "dir" };
