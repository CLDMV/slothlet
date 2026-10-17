/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_instance_query/counter/counter.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf with module-level state, to tell one loaded copy of it from another.
 * @module api_test_browser_instance_query.counter
 */

/** @type {number} */
let count = 0;

/**
 * Count one more call on this copy of the module.
 * @returns {number} Calls counted by this copy so far.
 */
export function bump() {
	count += 1;
	return count;
}

/**
 * Which version of the file this copy was loaded from.
 * @returns {string} The version marker.
 */
export function version() {
	return "v1";
}
