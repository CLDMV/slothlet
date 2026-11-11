/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_wrapped_check_crossings/host/host.mjs
 *	@Date: 2026-11-09T20:57:15-08:00 (1794286635)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T21:04:36-08:00 (1794287076)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The host's base for the `api.slothlet.wrapped` crossing fixture (#671).
 * @module api_test_wrapped_check_crossings/host
 */

/**
 * A marker so the base holds a leaf.
 * @returns {string} Marker.
 */
export function ping() {
	return "pong";
}
