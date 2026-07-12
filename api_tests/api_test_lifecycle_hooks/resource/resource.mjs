/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_hooks/resource/resource.mjs
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
 * @fileoverview Object-export lifecycle leaf whose `shutdown`/`destroy` are methods that read
 * `this` — used to verify nested hook invocation preserves the owning-node receiver.
 * @module api_test_lifecycle_hooks.resource
 * @memberof module:api_test_lifecycle_hooks
 */

/**
 * Object export whose lifecycle hooks are methods relying on `this`. When invoked via the
 * collected-hook path (`collectLifecycleHooks: true`), the receiver must be the owning node so
 * `this.marker` resolves — mirroring a direct `api.resource.shutdown()` call.
 * @namespace resource
 * @memberof module:api_test_lifecycle_hooks
 */
export const resource = {
	/**
	 * Identity marker read via `this` inside the lifecycle methods.
	 * @memberof module:api_test_lifecycle_hooks.resource
	 * @type {string}
	 */
	marker: "resource-42",

	/**
	 * Nested shutdown hook — records the `this`-resolved marker on the global test log.
	 * @function shutdown
	 * @memberof module:api_test_lifecycle_hooks.resource
	 * @returns {{ok: boolean}} Confirmation object.
	 * @example
	 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks' });
	 * api.resource.shutdown();
	 */
	shutdown() {
		(globalThis.__slothletHookLog ??= []).push(`resource:shutdown:${this?.marker ?? "NO_THIS"}`);
		return { ok: true };
	},

	/**
	 * Nested destroy hook — records the `this`-resolved marker on the global test log.
	 * @function destroy
	 * @memberof module:api_test_lifecycle_hooks.resource
	 * @returns {{ok: boolean}} Confirmation object.
	 * @example
	 * const api = await slothlet({ dir: './api_tests/api_test_lifecycle_hooks' });
	 * api.resource.destroy();
	 */
	destroy() {
		(globalThis.__slothletHookLog ??= []).push(`resource:destroy:${this?.marker ?? "NO_THIS"}`);
		return { ok: true };
	}
};
