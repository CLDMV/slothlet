/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-replay-remove-rule.test.vitest.mjs
 *	@Date: 2026-04-14T17:17:09-07:00 (1776212229)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:06-08:00 (1794882606)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Replay removeRule > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("rules.remove survives reload — rule remains removed after replay", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				policy: "allow"
			}
		});

		// Add then remove a deny rule
		const ruleId = api.slothlet.permissions.rules.add({ caller: "callers.**", target: "payments.**", effect: "deny" });
		api.slothlet.permissions.rules.remove(ruleId);

		// Verify allowed (rule removed)
		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);

		// Reload — both add and remove should replay
		api = await api.slothlet.reload();

		// Rule should still be removed after replay
		const result2 = await api.callers.paymentsCaller.callCharge(100);
		expect(result2.ok).toBe(true);
	});
});
