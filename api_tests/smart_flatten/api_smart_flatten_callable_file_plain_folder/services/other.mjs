/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_callable_file_plain_folder/services/other.mjs
 *	@Date: 2026-10-08T00:00:00-07:00 (1791442800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T00:00:00-07:00 (1791442800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#586): the same-named folder has no function of its own
 * @module api_smart_flatten_callable_file_plain_folder.services.other
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export function other() {
	return "folder-other";
}

/**
 * @returns {string} Marker naming this leaf.
 */
export function shared() {
	return "folder-shared";
}
