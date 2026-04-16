/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-error-denied.test.vitest.mjs
 *	@Date: 2026-04-14 17:19:39 -07:00 (1776212379)
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

describe.each(getMatrixConfigs())("Permissions > Error Denied > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("PERMISSION_DENIED error contains caller and target context", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "deny",
				rules: []
			}
		});

		await api.slothlet.api.add("payments", `${BASE}/payments`);
		await api.slothlet.api.add("admin", `${BASE}/admin`);
		await api.slothlet.api.add("callers", `${BASE}/callers`);

		try {
			await api.callers.untrustedCaller.callAdmin();
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err.message).toContain("PERMISSION_DENIED");
		}
	});
});
