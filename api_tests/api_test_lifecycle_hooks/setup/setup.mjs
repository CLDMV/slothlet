/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_hooks/setup/setup.mjs
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
 * @fileoverview Module-level shutdown/destroy leaf used to validate nested lifecycle hook discovery.
 * @module api_test_lifecycle_hooks.setup
 * @memberof module:api_test_lifecycle_hooks
 */

/**
 * Nested shutdown hook — records invocation on the global test log.
 * @function shutdown
 * @memberof module:api_test_lifecycle_hooks.setup
 * @returns {{ok: boolean}} Confirmation object.
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks' });
 * api.setup.shutdown();
 */
export function shutdown() {
	(globalThis.__slothletHookLog ??= []).push("setup:shutdown");
	return { ok: true };
}

/**
 * Nested destroy hook — records invocation on the global test log.
 * @function destroy
 * @memberof module:api_test_lifecycle_hooks.setup
 * @returns {{ok: boolean}} Confirmation object.
 * @example
 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks' });
 * api.setup.destroy();
 */
export function destroy() {
	(globalThis.__slothletHookLog ??= []).push("setup:destroy");
	return { ok: true };
}
