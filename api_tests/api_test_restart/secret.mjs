/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart/secret.mjs
 *	@Date: 2026-09-21T01:27:16+00:00 (1789954036)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:08 -07:00 (1791082988)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview restart() fixture (#504): permission targets.
 * @module api_test_restart.secret
 */

/**
 * Target of a config-declared deny rule.
 * @returns {string} "blocked".
 */
export function blocked() {
	return "blocked";
}

/**
 * Target of a runtime-added deny rule.
 * @returns {string} "open".
 */
export function open() {
	return "open";
}
