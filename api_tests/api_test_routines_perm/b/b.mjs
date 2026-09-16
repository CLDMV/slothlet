/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_perm/b/b.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
