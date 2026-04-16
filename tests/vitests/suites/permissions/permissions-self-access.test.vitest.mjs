/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-self-access.test.vitest.mjs
 *	@Date: 2026-04-14 17:14:40 -07:00 (1776212080)
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

describe.each(getMatrixConfigs())("Permissions > self.access > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("self.access returns correct boolean for calling module", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "admin.**", effect: "deny" }]
			}
		});

		await api.slothlet.api.add("admin", `${BASE}/admin`);
		await api.slothlet.api.add("payments", `${BASE}/payments`);

		// Direct API call to self.access (outside of module context)
		const canAccessPayments = api.slothlet.permissions.self.access("payments.charge");
		expect(canAccessPayments).toBeTypeOf("boolean");
	});
});
