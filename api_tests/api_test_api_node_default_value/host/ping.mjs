/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_default_value/host/ping.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host's own module, so the instance has a root to build from.
 * @module api_test_api_node_default_value/host
 */

/**
 * @returns {string} Always `"pong"`.
 */
export function ping() {
	return "pong";
}
