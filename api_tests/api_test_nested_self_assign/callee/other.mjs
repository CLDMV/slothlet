/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/callee/other.mjs
 *	@Date: 2026-10-18T01:21:07-07:00 (1792311667)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T01:51:33-07:00 (1792313493)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "callee" (moduleID "callee") by the nested self-assign ownership tests (#625):
// a second node of the callee module, which a caller may try to pass to one of its methods as `this`.

/**
 * An answer of the callee module's second node.
 * @returns {string} `"other"`.
 */
export function ping() {
	return "other";
}
