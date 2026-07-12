/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-enforcement-point.test.vitest.mjs
 *	@Date: 2026-04-14 17:16:07 -07:00 (1776212167)
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

describe.each(getMatrixConfigs())("Permissions > Enforcement Point > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("permission check fires before hooks — denied call does not trigger hook callbacks", async () => {
		let hookFired = false;

		api = await slothlet({
			...config,
			base: BASE,
			hook: { enabled: true },
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "deny" }]
			}
		});

		api.slothlet.hook.on("payments.**:before", () => {
			hookFired = true;
		});

		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
		expect(hookFired).toBe(false);
	});

	it("external calls from user code (no active module context) are exempt from enforcement", async () => {
		// When an API function is called directly from the host (e.g. from test code), there is no
		// active context — so no callerWrapper. Enforcement fails closed on an absent caller inside a
		// context, but a genuinely host-initiated call (no active context + the instance's base store
		// carrying the trusted-root marker) is allowed. Inter-module calls remain gated.
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "**", target: "payments.**", effect: "deny" }]
			}
		});

		// Direct external call: no active module context → callerWrapper is null → exempt
		const result = await api.payments.charge.process(100);
		expect(result.ok).toBe(true);
	});
});
