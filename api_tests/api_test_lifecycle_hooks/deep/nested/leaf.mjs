/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_hooks/deep/nested/leaf.mjs
 *	@Date: 2026-07-09 18:03:53 -07:00 (1783645433)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git@cldmv.net)
 *	@Last modified time: 2026-07-09 18:19:01 -07:00 (1783646341)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Deeply-nested shutdown leaf used to validate depth > 1 hook discovery.
 * @module api_test_lifecycle_hooks.deep.nested.leaf
 * @memberof module:api_test_lifecycle_hooks.deep.nested
 */

/**
 * Nested shutdown hook at depth > 1 — records invocation on the global test log.
 * @function shutdown
 * @memberof module:api_test_lifecycle_hooks.deep.nested.leaf
 * @returns {void}
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks' });
 * api.deep.nested.leaf.shutdown();
 */
export function shutdown() {
	(globalThis.__slothletHookLog ??= []).push("deep.nested:shutdown");
}
