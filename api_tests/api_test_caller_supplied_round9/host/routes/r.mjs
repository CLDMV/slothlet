/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round9/host/routes/r.mjs
 *	@Date: 2026-10-18T12:34:35-07:00 (1792352075)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T12:52:01-07:00 (1792353121)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A route that adds a folder by a path relative to its own file (#597).
 *
 * @module api_tests/api_test_caller_supplied_round9/host/routes/r
 */

/**
 * Add `./plug` at `p` from `depth` nested calls of the route's own.
 * @param {object} api - The api.
 * @param {number} depth - How many calls deep.
 * @returns {Promise<*>} What the add resolved to.
 * @public
 * @example
 * await addDeep(api, 15);
 */
export function addDeep(api, depth) {
	if (depth > 0) {
		const added = addDeep(api, depth - 1);
		return added;
	}
	return api.slothlet.api.add("p", "./plug");
}
