/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round9/host/main.mjs
 *	@Date: 2026-10-18T12:34:35-07:00 (1792352075)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T12:52:00-07:00 (1792353120)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host's entry: it asks for a route's add through a wrapper of its own named `slothlet.mjs` (#597).
 *
 * @module api_tests/api_test_caller_supplied_round9/host/main
 */

import { run } from "./wrap/slothlet.mjs";
import { addDeep } from "./routes/r.mjs";

/**
 * Have the route add `./plug` from deep inside its own calls, through the wrapper.
 * @param {object} api - The api.
 * @param {number} depth - How many calls deep.
 * @returns {Promise<*>} What the add resolved to.
 * @public
 * @example
 * await addThroughWrap(api, 15);
 */
export function addThroughWrap(api, depth) {
	return run(() => addDeep(api, depth));
}
