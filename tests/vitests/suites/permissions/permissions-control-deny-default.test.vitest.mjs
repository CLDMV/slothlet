/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-control-deny-default.test.vitest.mjs
 *	@Date: 2026-04-14 17:15:46 -07:00 (1776212146)
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

describe.each(getMatrixConfigs())("Permissions > Control Deny Default > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("built-in deny rule on slothlet.permissions.control.** blocks enable/disable by default", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// The built-in deny rule should exist for control.**
		const rules = api.slothlet.permissions.global.rulesForPath("slothlet.permissions.control.enable");
		const builtinDeny = rules.find((r) => r.caller === "**" && r.effect === "deny" && r.target === "slothlet.permissions.control.**");
		expect(builtinDeny).toBeDefined();
	});
});
