/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permissions_owner/base/core/sub/beta.mjs
 *	@Date: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 12:00:00 -07:00 (1790622000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Base-loaded leaf in a subdirectory (#509).
 * @module api_tests/api_test_permissions_owner/base/core/sub/beta
 */

/**
 * Ping.
 * @returns {string} Marker.
 * @public
 * @example
 * api.core.sub.beta.ping(); // "pong"
 */
export function ping() {
	return "pong";
}
