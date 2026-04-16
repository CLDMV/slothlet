/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-immutability.test.vitest.mjs
 *	@Date: 2026-04-14 17:14:24 -07:00 (1776212064)
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

describe.each(getMatrixConfigs())("Permissions > Immutability > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("rules returned by rulesForPath are read-only snapshots", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "deny" }]
			}
		});

		// Get the rule for payments
		const rules = api.slothlet.permissions.global.rulesForPath("payments.charge.process");
		const denyRule = rules.find((r) => r.effect === "deny" && r.target === "payments.**");
		expect(denyRule).toBeDefined();
		expect(denyRule.id).toBeTypeOf("string");

		// Mutating the returned object should not affect the internal state
		denyRule.effect = "allow";

		// Re-fetch — original rule should still be deny
		const rules2 = api.slothlet.permissions.global.rulesForPath("payments.charge.process");
		const denyRule2 = rules2.find((r) => r.target === "payments.**");
		expect(denyRule2.effect).toBe("deny");
	});
});
