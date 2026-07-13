/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_hooks_walk/anchor.mjs
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
 * @fileoverview Plain anchor leaf for the collect() walk fixture — provides a resolvable
 * wrapper so a test can recover the internal slothlet instance via `resolveWrapper(api.anchor)`.
 * @module api_test_lifecycle_hooks_walk.anchor
 * @memberof module:api_test_lifecycle_hooks_walk
 */

/**
 * Trivial callable leaf. No lifecycle hook of its own.
 * @function ping
 * @memberof module:api_test_lifecycle_hooks_walk.anchor
 * @returns {string} The literal string "pong".
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks_walk' });
 * api.anchor.ping(); // "pong"
 */
export function ping() {
	return "pong";
}
