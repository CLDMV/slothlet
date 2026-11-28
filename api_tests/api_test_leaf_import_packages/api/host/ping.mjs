/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_leaf_import_packages/api/host/ping.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:34-08:00 (1795868914)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base tree the packages' api folders are mounted on.
 *
 * @module api_tests/api_test_leaf_import_packages/api/host/ping
 */

/**
 * Answer a ping.
 * @returns {string} The value.
 * @public
 * @example
 * api.host.ping(); // "pong"
 */
export function ping() {
	return "pong";
}
