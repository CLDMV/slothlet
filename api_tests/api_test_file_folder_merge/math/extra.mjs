/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_file_folder_merge/math/extra.mjs
 *	@Date: 2026-11-25T12:17:46-08:00 (1795637866)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:58-08:00 (1795868878)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Sibling file keeping the folder above the single-file threshold, so the collision
 * composes through the folder's multi-file path.
 * @module api_test_file_folder_merge.math.extra
 * @memberof module:api_test_file_folder_merge
 */

/**
 * Folder-only member.
 * @returns {string} Marker proving the folder's sibling file reached the merged node.
 * @example
 * api.math.extra(); // "dir-extra"
 */
export function extra() {
	return "dir-extra";
}
