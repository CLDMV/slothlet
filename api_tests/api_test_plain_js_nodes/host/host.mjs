/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_plain_js_nodes/host/host.mjs
 *	@Date: 2026-11-05T06:11:33-08:00 (1793887893)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:09-08:00 (1795868949)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base the #667 tests mount their modules onto.
 * @module api_test_plain_js_nodes/host
 */

/**
 * @returns {string} Marker.
 */
export function ping() {
	return "pong";
}
