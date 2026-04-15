/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-audit-verbose.test.vitest.mjs
 *	@Date: 2026-04-14 17:20:32 -07:00 (1776212432)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:33:58 -07:00 (1776213238)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Audit Verbose > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("verbose audit mode emits permission:checked on every access check", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				audit: "verbose",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "allow" }]
			}
		});

		const allowedEvents = [];
		api.slothlet.lifecycle.on("permission:allowed", (data) => {
			allowedEvents.push(data);
		});

		await api.callers.paymentsCaller.callCharge(100);

		expect(allowedEvents.length).toBeGreaterThan(0);
		expect(allowedEvents[0]).toHaveProperty("caller");
		expect(allowedEvents[0]).toHaveProperty("target");
	});
});
