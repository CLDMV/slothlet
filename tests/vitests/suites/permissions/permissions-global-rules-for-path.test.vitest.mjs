/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-global-rules-for-path.test.vitest.mjs
 *	@Date: 2026-04-14T17:15:09-07:00 (1776212109)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:52-08:00 (1794882592)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > global.rules.path > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("lists all matching rules for a target path", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/payments`,
			permissions: {
				policy: "allow",
				rules: [
					{ caller: "untrusted.**", target: "admin.**", effect: "deny" },
					{ caller: "callers.**", target: "admin.**", effect: "allow" },
					{ caller: "**", target: "payments.**", effect: "allow" }
				]
			}
		});

		const adminRules = api.slothlet.permissions.global.rules.path("admin.manage");
		expect(adminRules.length).toBeGreaterThanOrEqual(2);

		const paymentRules = api.slothlet.permissions.global.rules.path("payments.charge");
		expect(paymentRules.length).toBeGreaterThanOrEqual(1);
	});
});
