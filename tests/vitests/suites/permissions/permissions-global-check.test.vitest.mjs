/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-global-check.test.vitest.mjs
 *	@Date: 2026-04-14 17:14:59 -07:00 (1776212099)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:16:57 -07:00 (1776212217)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > global.checkAccess > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("returns correct boolean for arbitrary caller/target pairs", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/payments`,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }]
			}
		});

		const allowed = api.slothlet.permissions.global.checkAccess("payments.charge", "db.read");
		expect(allowed).toBe(true);

		const denied = api.slothlet.permissions.global.checkAccess("untrusted.plugin", "admin.manage");
		expect(denied).toBe(false);
	});

	it("global.checkAccess returns true when permission system is disabled (no permissions config)", async () => {
		// No permissions config → PermissionManager is constructed but #enabled = false.
		// Calling checkAccess directly bypasses the isEnabled() guard in unified-wrapper,
		// hitting the `if (!this.#enabled) return true` fast path in PermissionManager.
		api = await slothlet({
			...config,
			dir: `${TEST_DIRS.API_TEST_PERMISSIONS}/payments`
		});

		// Even with a deny-all approach, disabled manager always allows
		const result = api.slothlet.permissions.global.checkAccess("any.caller", "any.target");
		expect(result).toBe(true);
	});
});
