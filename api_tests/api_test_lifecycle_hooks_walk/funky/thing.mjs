/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_lifecycle_hooks_walk/funky/thing.mjs
 *	@Date: 2026-07-11T21:01:15-07:00 (1783828875)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:40-08:00 (1795868920)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf that also publishes a `__`-prefixed export. Slothlet attaches the
 * `__`-prefixed name as an own enumerable key on the leaf's wrapper, so the lifecycle walk
 * over the wrapper's keys meets it next to the ordinary `ping` leaf.
 * @module api_test_lifecycle_hooks_walk.funky.thing
 * @memberof module:api_test_lifecycle_hooks_walk.funky
 */

/**
 * Ordinary callable leaf — the ordinary key the collect() walk descends into.
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
 * A `__`-prefixed export. It lands as an own enumerable key on the wrapper, and the collect()
 * walk must handle it without error.
 * @memberof module:api_test_lifecycle_hooks_walk.funky.thing
 * @type {object}
 */
export const __weird = { hello: () => "hi" };
