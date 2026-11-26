/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_supplied_rule_ceiling/api/root/root.mjs
 *	@Date: 2026-11-25T01:38:18-08:00 (1795599498)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:06:03-08:00 (1795601163)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base module: nothing of its own; `runner` and `adder` are mounted beside it.
 * @module api_test_supplied_rule_ceiling/api/root
 */

/**
 * A member so the base module has a leaf.
 * @returns {string} "root".
 */
export function ping() {
	return "root";
}
