/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_permission_principals/billing/plans.mjs
 *	@Date: 2026-09-26 22:18:59 -07:00 (1790486339)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:57 -07:00 (1791082977)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * A plugin that owns the "billing" principal (#459), keyed by org rather than by user.
 */

const plans = new Map();
let resolveCount = 0;

/**
 * Register the "billing" principal.
 * @returns {void}
 */
export const setup = () =>
	self.slothlet.permissions.principal.register("billing", {
		key: (ctx) => ctx.org,
		resolve: async (org) => {
			resolveCount++;
			return { plan: plans.get(org) ?? "free" };
		}
	});

/**
 * Set an org's plan.
 * @param {string} org - Org id.
 * @param {string} plan - Plan name.
 * @returns {void}
 */
export const assign = (org, plan) => {
	plans.set(org, plan);
};

/**
 * Number of times the resolver ran.
 * @returns {number} Resolve count.
 */
export const resolves = () => resolveCount;
