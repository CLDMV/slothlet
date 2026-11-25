/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_unknown_caller_ext/api/cache/context.mjs
 *	@Date: 2026-11-09T01:56:49-08:00 (1794218209)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T11:38:20-08:00 (1795549100)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The extension's cache (`ext.cache.context.subscribe`), in a folder of its own so a lazy mount loads it apart.
 * @module api_test_unknown_caller_ext.api.cache.context
 */

/**
 * Subscribe.
 * @returns {string} `"subscribed"`.
 */
export function subscribe() {
	return "subscribed";
}
