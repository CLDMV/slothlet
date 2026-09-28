/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lock_caller_caller/roles/registry.mjs
 *	@Date: 2026-09-28 00:00:00 -07:00 (1790578800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 00:00:00 -07:00 (1790578800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Owner of the "roles" principal (#459) for the `lockCaller.caller()` tests (#477).
 * Grants are per user, per project.
 *
 * @module api_tests/api_test_lock_caller_caller/roles/registry
 */

import { self } from "@cldmv/slothlet/runtime";

const grants = new Map();

/**
 * Register the "roles" principal, keyed by `ctx.user`.
 * @returns {void}
 * @public
 * @example
 * api.roles.registry.setup();
 */
export function setup() {
	self.slothlet.permissions.principal.register("roles", {
		key: (ctx) => ctx.user,
		resolve: async (user) => ({ projects: { ...(grants.get(user) ?? {}) } })
	});
}

/**
 * Grant a user permissions on a project.
 * @param {string} user - User id.
 * @param {string} projectId - Project id.
 * @param {string[]} perms - Permissions.
 * @returns {void}
 * @public
 * @example
 * api.roles.registry.grant("u1", "p1", ["read"]);
 */
export function grant(user, projectId, perms) {
	grants.set(user, { ...(grants.get(user) ?? {}), [projectId]: perms });
}
