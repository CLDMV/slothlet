/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-tiebreak.test.vitest.mjs
 *	@Date: 2026-04-14 17:13:27 -07:00 (1776212007)
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

describe.each(getMatrixConfigs())("Permissions > Tiebreak > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("last-registered rule wins at same specificity", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "callers.**", target: "payments.**", effect: "deny" },
					{ caller: "callers.**", target: "payments.**", effect: "allow" }
				]
			}
		});

		// Last rule (allow) should win
		const result = await api.callers.paymentsCaller.callCharge(100);
		expect(result.ok).toBe(true);
	});

	it("deny wins when registered last at same specificity", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "callers.**", target: "payments.**", effect: "allow" },
					{ caller: "callers.**", target: "payments.**", effect: "deny" }
				]
			}
		});

		// Last rule (deny) should win
		try {
			await api.callers.paymentsCaller.callCharge(100);
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});
});
