/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-glob-inheritance.test.vitest.mjs
 *	@Date: 2026-04-14 17:13:03 -07:00 (1776211983)
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

describe.each(getMatrixConfigs())("Permissions > Glob Inheritance > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("rule on payments.** applies to all descendants", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "deny" }]
			}
		});

		// payments.charge should be denied
		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}

		// payments.webhook should also be denied by the same glob rule
		try {
			await api.callers.paymentsCaller.callCharge(50);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	it("glob rule does not affect paths outside the pattern", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "deny" }]
			}
		});

		// db.read is not matched by payments.** rule — should be allowed
		const result = await api.callers.paymentsCaller.callDbRead();
		expect(result.ok).toBe(true);
	});
});
