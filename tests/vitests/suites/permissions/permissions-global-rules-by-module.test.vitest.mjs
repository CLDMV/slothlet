/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-global-rules-by-module.test.vitest.mjs
 *	@Date: 2026-04-14T17:15:18-07:00 (1776212118)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:27-08:00 (1795869147)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > global.rules.module > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("lists all rules owned by a module", async () => {
		api = await slothlet({
			...config,
			base: `${BASE}/callers`,
			permissions: {
				policy: "allow"
			}
		});

		const moduleID = await api.slothlet.api.add("payments", `${BASE}/payments`, {
			permissions: {
				deny: ["admin.**", "slothlet.*"]
			}
		});

		const rules = api.slothlet.permissions.global.rules.module(moduleID);
		expect(rules.length).toBeGreaterThanOrEqual(2);
		expect(rules.every((r) => r.ownerModuleID === moduleID)).toBe(true);
	});
});
