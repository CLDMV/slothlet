/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permission_principals/roles/registry.mjs
 *	@Date: 2026-09-26T22:18:59-07:00 (1790486339)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:40-07:00 (1791090880)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * A plugin that owns the "roles" principal (#459). Registered from `setup()` so tests control when.
 * Grants are per user, per project: `grants.get(user)[projectId]` is a list of permissions.
 */

const grants = new Map();
let resolveCount = 0;

/**
 * Register the "roles" principal.
 * @param {object} [options] - Extra definition fields (e.g. `maxAge`).
 * @param {boolean} [options.record=false] - When true, the resolver records to `ledger.log` — a target only
 *   this plugin may call, so a successful resolve proves it ran as this plugin.
 * @param {boolean} [options.race=false] - When true, the user's roles are invalidated while the resolve
 *   is still in flight, as a revocation landing mid-resolve would.
 * @returns {void}
 */
export const setup = ({ record = false, race = false, ...options } = {}) =>
	self.slothlet.permissions.principal.register("roles", {
		key: (ctx) => ctx.user,
		resolve: async (user) => {
			resolveCount++;
			if (record) self.ledger.log.record(`roles:${user}`);
			const snapshot = { projects: { ...(grants.get(user) ?? {}) } };
			if (race) {
				await null;
				self.slothlet.permissions.principal.invalidate("roles", user);
			}
			return snapshot;
		},
		...options
	});

/**
 * Grant a user permissions on a project.
 * @param {string} user - User id.
 * @param {string} projectId - Project id.
 * @param {string[]} perms - Permissions.
 * @returns {void}
 */
export const grant = (user, projectId, perms) => {
	grants.set(user, { ...(grants.get(user) ?? {}), [projectId]: perms });
};

/**
 * Revoke a user's permissions on a project and invalidate their cached roles.
 * @param {string} user - User id.
 * @param {string} projectId - Project id.
 * @returns {boolean} Result of invalidate.
 */
export const revoke = (user, projectId) => {
	const current = { ...(grants.get(user) ?? {}) };
	delete current[projectId];
	grants.set(user, current);
	return self.slothlet.permissions.principal.invalidate("roles", user);
};

/**
 * Number of times the resolver ran.
 * @returns {number} Resolve count.
 */
export const resolves = () => resolveCount;

/**
 * Unregister the "roles" principal.
 * @returns {boolean} Result of unregister.
 */
export const drop = () => self.slothlet.permissions.principal.unregister("roles");
