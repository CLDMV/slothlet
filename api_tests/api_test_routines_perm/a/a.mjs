/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_perm/a/a.mjs
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Routine contributor A (self.a.initialize). Reaches the gated target through ambient
 * `self.secret.read()`. The policy ALLOWS caller `a` → `secret`, so this succeeds — but only if the
 * routine runs it under A's OWN identity (#393).
 * @module api_test_routines_perm.a
 * @memberof module:api_test_routines_perm
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * @function initialize
 * @memberof module:api_test_routines_perm
 * @returns {string} The value read from the coordinator.
 */
export function initialize() {
	const value = self.secret.read();
	(globalThis.__slothletPermLog ??= []).push("a:ok");
	return value;
}
