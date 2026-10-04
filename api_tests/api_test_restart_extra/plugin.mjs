/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart_extra/plugin.mjs
 *	@Date: 2026-09-21T01:27:16+00:00 (1789954036)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:44-07:00 (1791090884)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview restart() fixture (#504): mounted at runtime with api.slothlet.api.add().
 * @module api_test_restart_extra.plugin
 */

/**
 * @returns {string} "plugin".
 */
export function ping() {
	return "plugin";
}
