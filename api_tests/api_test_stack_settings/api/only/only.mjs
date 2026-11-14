/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stack_settings/api/only/only.mjs
 *	@Date: 2026-11-14T12:00:00-08:00 (1794686400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T12:00:00-08:00 (1794686400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node only `good` may call.
 * @module api_test_stack_settings.only
 * @memberof module:api_test_stack_settings
 */

/**
 * The value behind the rule.
 * @returns {string} "GOOD-ONLY".
 */
export function get() {
	return "GOOD-ONLY";
}
