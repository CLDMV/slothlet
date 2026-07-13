/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_hooks_walk/funky/thing.mjs
 *	@Date: 2026-07-11 21:01:15 -07:00 (1783785675)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-11 21:01:15 -07:00 (1783785675)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Leaf that also publishes a `____`-prefixed export. Slothlet attaches the
 * `____`-prefixed name as an own enumerable key on the leaf's wrapper, so walking the wrapper's
 * keys in `_collectLifecycleHooks` exercises the `!key.startsWith("____")` skip guard.
 * @module api_test_lifecycle_hooks_walk.funky.thing
 * @memberof module:api_test_lifecycle_hooks_walk.funky
 */

/**
 * Ordinary callable leaf — the non-`____` key the collect() walk descends into.
 * @function ping
 * @memberof module:api_test_lifecycle_hooks_walk.funky.thing
 * @returns {string} The literal string "pong".
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks_walk' });
 * api.funky.thing.ping(); // "pong"
 */
export function ping() {
	return "pong";
}

/**
 * A `____`-prefixed export. It lands as an own enumerable key on the wrapper, and the collect()
 * walk must skip it (its `startsWith("____")` guard) rather than descend into it.
 * @memberof module:api_test_lifecycle_hooks_walk.funky.thing
 * @type {object}
 */
export const ____weird = { hello: () => "hi" };
