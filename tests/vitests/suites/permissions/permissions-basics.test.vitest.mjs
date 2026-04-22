/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-basics.test.vitest.mjs
 *	@Date: 2026-04-14 17:11:59 -07:00 (1776211919)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:12:59 -07:00 (1776211979)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Basics > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("initializes PermissionManager via auto-discovery", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/payments`,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		expect(api.slothlet.permissions).toBeDefined();
		expect(api.slothlet.permissions.addRule).toBeTypeOf("function");
		expect(api.slothlet.permissions.removeRule).toBeTypeOf("function");
		expect(api.slothlet.permissions.self).toBeDefined();
		expect(api.slothlet.permissions.global).toBeDefined();
		expect(api.slothlet.permissions.control).toBeDefined();
	});

	it("config rules are present after initialization", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/payments`,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }]
			}
		});

		const rules = api.slothlet.permissions.global.rulesForPath("admin.manage");
		expect(rules.length).toBeGreaterThan(0);
		expect(rules.some((r) => r.caller === "untrusted.**" && r.effect === "deny")).toBe(true);
	});

	it("enabled toggle controls enforcement", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				enabled: false
			}
		});

		// With permissions disabled, even deny-all default should not block
		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);
	});
});
