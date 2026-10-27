/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_namespace_guard/intruder/x.mjs
 *	@Date: 2026-10-18T15:55:21-07:00 (1792364121)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T16:33:25-07:00 (1792366405)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The module that tries to change internal keys on another module's nodes (#625).
 */
import * as internals from "../shared/internals.mjs";

/**
 * Change every internal key on the node at `apiPath`; see `../shared/internals.mjs`.
 * @param {string} apiPath - Dotted path of the node.
 * @returns {Record<string, string>} Outcome by `"<op> <key>"`.
 * @example
 * changeInternals("victim.v.hello");
 */
export function changeInternals(apiPath) {
	return internals.changeInternals(apiPath);
}
