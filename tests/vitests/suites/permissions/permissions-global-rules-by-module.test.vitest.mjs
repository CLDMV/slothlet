/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-global-rules-by-module.test.vitest.mjs
 *	@Date: 2026-04-14 17:15:18 -07:00 (1776212118)
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

describe.each(getMatrixConfigs())("Permissions > global.rulesByModule > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("lists all rules owned by a module", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		const moduleID = await api.slothlet.api.add("payments", `${BASE}/payments`, {
			permissions: {
				deny: ["admin.**", "slothlet.*"]
			}
		});

		const rules = api.slothlet.permissions.global.rulesByModule(moduleID);
		expect(rules.length).toBeGreaterThanOrEqual(2);
		expect(rules.every((r) => r.ownerModuleID === moduleID)).toBe(true);
	});
});
