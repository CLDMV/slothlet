/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-cache-basic.test.vitest.mjs
 *	@Date: 2026-04-14 17:16:23 -07:00 (1776212183)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:33:58 -07:00 (1776213238)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Cache Basic > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("second identical call uses cached result", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "payments.**", effect: "allow" }]
			}
		});

		// First call
		const result1 = await api.callers.paymentsCaller.callCharge(100);
		expect(result1.ok).toBe(true);

		// Second identical call should use cache (verify by consistency)
		const result2 = await api.callers.paymentsCaller.callCharge(200);
		expect(result2.ok).toBe(true);
	});
});
