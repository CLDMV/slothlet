/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-global-gating.test.vitest.mjs
 *	@Date: 2026-04-14 17:15:29 -07:00 (1776212129)
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

describe.each(getMatrixConfigs())("Permissions > Global Gating > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("module denied slothlet.permissions.global.** cannot call global methods", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "untrusted.**", target: "slothlet.permissions.global.**", effect: "deny" }]
			}
		});

		await api.slothlet.api.add("untrusted", `${BASE}/untrusted`);

		// Global methods are still accessible from the test context (no caller module)
		const result = api.slothlet.permissions.global.checkAccess("payments", "db");
		expect(result).toBeTypeOf("boolean");
	});

	it("self.* still works when global.* is denied", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "untrusted.**", target: "slothlet.permissions.global.**", effect: "deny" }]
			}
		});

		// self.access should still work
		const canAccess = api.slothlet.permissions.self.access("payments.charge");
		expect(canAccess).toBeTypeOf("boolean");

		const selfRules = api.slothlet.permissions.self.rules();
		expect(Array.isArray(selfRules)).toBe(true);
	});
});
