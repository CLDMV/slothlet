/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-global-rules-for-path.test.vitest.mjs
 *	@Date: 2026-04-14 17:15:09 -07:00 (1776212109)
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

describe.each(getMatrixConfigs())("Permissions > global.rulesForPath > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("lists all matching rules for a target path", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/payments`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "untrusted.**", target: "admin.**", effect: "deny" },
					{ caller: "callers.**", target: "admin.**", effect: "allow" },
					{ caller: "**", target: "payments.**", effect: "allow" }
				]
			}
		});

		const adminRules = api.slothlet.permissions.global.rulesForPath("admin.manage");
		expect(adminRules.length).toBeGreaterThanOrEqual(2);

		const paymentRules = api.slothlet.permissions.global.rulesForPath("payments.charge");
		expect(paymentRules.length).toBeGreaterThanOrEqual(1);
	});
});
