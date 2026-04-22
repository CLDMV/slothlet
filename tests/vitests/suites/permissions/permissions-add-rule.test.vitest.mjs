/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-add-rule.test.vitest.mjs
 *	@Date: 2026-04-14 17:13:57 -07:00 (1776212037)
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

describe.each(getMatrixConfigs())("Permissions > addRule > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("programmatic addRule adds a rule enforced immediately", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// Should be allowed before rule
		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);

		// Add deny rule
		const ruleId = api.slothlet.permissions.addRule({ caller: "callers.**", target: "payments.**", effect: "deny" });
		expect(ruleId).toBeTypeOf("string");

		// Should be denied after rule
		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});
});
