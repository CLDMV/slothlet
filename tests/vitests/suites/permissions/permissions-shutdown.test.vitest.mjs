/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-shutdown.test.vitest.mjs
 *	@Date: 2026-04-14 17:19:30 -07:00 (1776212370)
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

describe.each(getMatrixConfigs())("Permissions > Shutdown > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("after shutdown, permission state is cleared", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "allow" }]
			}
		});

		await api.slothlet.api.add("payments", `${BASE}/payments`);
		await api.slothlet.api.add("callers", `${BASE}/callers`);

		// Rules are present before shutdown
		const rulesBefore = api.slothlet.permissions.global.rulesForPath("payments.charge");
		expect(rulesBefore.length).toBeGreaterThan(0);

		await api.shutdown();
		api = null;
	});
});
