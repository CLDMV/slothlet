/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-replay-add-rule.test.vitest.mjs
 *	@Date: 2026-04-14 17:16:59 -07:00 (1776212219)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:33:59 -07:00 (1776213239)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Replay addRule > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("addRule survives module hot-reload via operationHistory replay", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// Add a deny rule
		api.slothlet.permissions.addRule({ caller: "callers.**", target: "payments.**", effect: "deny" });

		// Verify denied
		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}

		// Reload
		api = await api.slothlet.reload();

		// Rule should be replayed — still denied
		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});
});
