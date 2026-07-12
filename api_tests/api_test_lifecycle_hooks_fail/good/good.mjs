/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_hooks_fail/good/good.mjs
 *	@Date: 2026-07-11 08:37:55 -07:00 (1783784275)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-11 08:37:55 -07:00 (1783784275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Healthy sibling leaf that materializes cleanly and exports a real `shutdown`
 * hook — proves genuine hooks are still collected when a sibling subtree fails to materialize.
 * @module api_test_lifecycle_hooks_fail.good
 * @memberof module:api_test_lifecycle_hooks_fail
 */

/**
 * Real nested shutdown hook that materializes without error.
 * @function shutdown
 * @memberof module:api_test_lifecycle_hooks_fail.good
 * @returns {{ok: boolean}} Confirmation object.
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks_fail', mode: 'lazy' });
 * api.good.shutdown();
 */
export function shutdown() {
	(globalThis.__slothletHookLog ??= []).push("good:shutdown");
	return { ok: true };
}
