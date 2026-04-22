/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-audit-denied.test.vitest.mjs
 *	@Date: 2026-04-14 17:20:12 -07:00 (1776212412)
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

describe.each(getMatrixConfigs())("Permissions > Audit Denied > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("permission:denied lifecycle event emits on every denial", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				audit: true,
				rules: [{ caller: "callers.untrustedCaller.**", target: "admin.**", effect: "deny" }]
			}
		});

		const deniedEvents = [];
		api.slothlet.lifecycle.on("permission:denied", (data) => {
			deniedEvents.push(data);
		});

		try {
			await api.callers.untrustedCaller.callAdmin();
		} catch {
			// expected
		}

		expect(deniedEvents.length).toBeGreaterThan(0);
		expect(deniedEvents[0]).toHaveProperty("caller");
		expect(deniedEvents[0]).toHaveProperty("target");
	});
});
