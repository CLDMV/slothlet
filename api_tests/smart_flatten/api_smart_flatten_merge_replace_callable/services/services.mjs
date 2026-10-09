/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_merge_replace_callable/services/services.mjs
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
 * @fileoverview Fixture (#584): the same-named folder's file; its own default function and a conflicting member
 * @module api_smart_flatten_merge_replace_callable.services.services
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export default function services() {
	return "inner-services";
}

/**
 * @returns {string} Marker naming this leaf.
 */
export function shared() {
	return "inner-shared";
}

/** @type {string} */
export const type = "inner-type";
