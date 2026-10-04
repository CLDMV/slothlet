/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_perm/b/b.mjs
 *	@Date: 2026-09-15T21:35:50-07:00 (1789533350)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:02-07:00 (1791091682)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Routine contributor B (self.b.initialize). Reaches the SAME gated target through
 * ambient `self.secret.read()`. The policy has no allow for caller `b` (default deny), so this must
 * be DENIED with PERMISSION_DENIED — proving B ran under B's OWN identity, not A's or a shared one
 * (#393). The success log push is unreachable (the read throws first) and only present so the test
 * can assert it never ran.
 * @module api_test_routines_perm.b
 * @memberof module:api_test_routines_perm
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * @function initialize
 * @memberof module:api_test_routines_perm
 * @returns {string} Never returns under the test policy — the gated read throws PERMISSION_DENIED.
 */
export function initialize() {
	const value = self.secret.read();
	(globalThis.__slothletPermLog ??= []).push("b:ok");
	return value;
}
