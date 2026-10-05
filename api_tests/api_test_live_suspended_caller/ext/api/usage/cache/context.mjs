/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/ext/api/usage/cache/context.mjs
 *	@Date: 2026-09-28T18:00:00-07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:37-07:00 (1791090877)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The extension's context cache — reachable by the extension itself only.
 * @module api_test_live_suspended_caller.ext.usage.cache.context
 */

const subscribers = new Set();

/**
 * Subscribe to updates.
 * @param {Function} fn - Subscriber.
 * @returns {Function} Unsubscribe.
 */
export function subscribe(fn) {
	subscribers.add(fn);
	return () => subscribers.delete(fn);
}
