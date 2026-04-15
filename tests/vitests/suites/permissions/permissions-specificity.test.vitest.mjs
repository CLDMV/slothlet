/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-specificity.test.vitest.mjs
 *	@Date: 2026-04-14 17:13:15 -07:00 (1776211995)
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

describe.each(getMatrixConfigs())("Permissions > Specificity > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("exact rule beats glob rule", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "callers.**", target: "payments.**", effect: "deny" },
					{ caller: "callers.paymentsCaller.callCharge", target: "payments.charge.process", effect: "allow" }
				]
			}
		});

		// Exact allow should win over glob deny
		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);
	});

	it("single-glob beats multi-glob", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "**", target: "**", effect: "deny" },
					{ caller: "callers.paymentsCaller.*", target: "payments.charge.*", effect: "allow" }
				]
			}
		});

		// Single-glob should beat multi-glob (**)
		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);
	});
});
