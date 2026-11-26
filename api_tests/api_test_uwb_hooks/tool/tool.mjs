/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_uwb_hooks/tool/tool.mjs
 *	@Date: 2026-11-25T01:38:31-08:00 (1795599511)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:08:01-08:00 (1795601281)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The folder's own function.
 */

/**
 * Echo the argument with a prefix.
 * @param {string} x - The argument.
 * @returns {string} `"tool:" + x`.
 */
export default function tool(x) {
	return `tool:${x}`;
}
