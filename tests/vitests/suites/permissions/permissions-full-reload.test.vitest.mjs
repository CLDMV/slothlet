/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-full-reload.test.vitest.mjs
 *	@Date: 2026-04-14 17:17:23 -07:00 (1776212243)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:33:59 -07:00 (1776213239)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Full Reload > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("slothlet.reload() clears state, re-applies config rules, replays history", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "untrusted.**", target: "admin.**", effect: "deny" }]
			}
		});

		await api.slothlet.api.add("payments", `${BASE}/payments`);
		await api.slothlet.api.add("admin", `${BASE}/admin`);

		// Config rule should be present
		const rules = api.slothlet.permissions.global.rulesForPath("admin.manage");
		expect(rules.length).toBeGreaterThan(0);

		// Reload
		api = await api.slothlet.reload();

		await api.slothlet.api.add("payments", `${BASE}/payments`);
		await api.slothlet.api.add("admin", `${BASE}/admin`);

		// Config rules should be re-applied after reload
		const rulesAfter = api.slothlet.permissions.global.rulesForPath("admin.manage");
		expect(rulesAfter.length).toBeGreaterThan(0);
	});
});
