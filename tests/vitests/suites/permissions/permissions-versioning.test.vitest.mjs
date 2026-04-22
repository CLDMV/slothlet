/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-versioning.test.vitest.mjs
 *	@Date: 2026-04-14 17:16:46 -07:00 (1776212206)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:34:00 -07:00 (1776213240)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Dynamic api.add > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("checkAccess allows access for dynamically-added module under default allow policy", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		await api.slothlet.api.add("payments", `${BASE}/payments`);

		// Verify checkAccess correctly evaluates a dynamically-added module path under default allow policy
		const allowed = api.slothlet.permissions.global.checkAccess("callers.paymentsCaller", "payments.charge");
		expect(allowed).toBe(true);
	});
});
