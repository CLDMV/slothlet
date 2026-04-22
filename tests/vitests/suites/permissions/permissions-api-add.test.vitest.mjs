/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-api-add.test.vitest.mjs
 *	@Date: 2026-04-14 17:13:47 -07:00 (1776212027)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:16:56 -07:00 (1776212216)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > api.add > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("permissions declared via api.add options create correct rules", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// Use api.add to add rules for the payments module — the caller pattern is payments.**
		await api.slothlet.api.add("extra", `${BASE}/untrusted`, {
			permissions: {
				deny: ["admin.**"],
				allow: ["db.read.**"]
			}
		});

		// Verify deny rule was created with caller = extra.**
		const denyRules = api.slothlet.permissions.global.rulesForPath("admin.manage.createUser");
		const denyRule = denyRules.find((r) => r.caller === "extra.**" && r.effect === "deny");
		expect(denyRule).toBeDefined();
		expect(denyRule.target).toBe("admin.**");

		// Verify allow rule was created with caller = extra.**
		const allowRules = api.slothlet.permissions.global.rulesForPath("db.read.query");
		const allowRule = allowRules.find((r) => r.caller === "extra.**" && r.effect === "allow");
		expect(allowRule).toBeDefined();
		expect(allowRule.target).toBe("db.read.**");
	});
});
