/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_callable_file_plain_folder/services.mjs
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
 * @fileoverview Fixture (#586): the root file; a default function plus named members
 * @module api_smart_flatten_callable_file_plain_folder.services
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export default function services() {
	return "root-services";
}

/**
 * @returns {string} Marker naming this leaf.
 */
export function extra() {
	return "root-extra";
}

/**
 * @returns {string} Marker naming this leaf.
 */
export function shared() {
	return "root-shared";
}
