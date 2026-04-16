/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-config-validation.test.vitest.mjs
 *	@Date: 2026-04-14 17:20:42 -07:00 (1776212442)
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

describe.each(getMatrixConfigs())("Permissions > Config Validation > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("invalid defaultPolicy value is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				dir: `${BASE}/callers`,
				permissions: {
					defaultPolicy: "invalid",
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid defaultPolicy");
		} catch (err) {
			expect(err.message).toBeDefined();
		}
	});

	it("permissions config with non-array rules is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				dir: `${BASE}/callers`,
				permissions: {
					defaultPolicy: "deny",
					rules: "not-an-array"
				}
			});
			expect.unreachable("Should have thrown for non-array rules");
		} catch (err) {
			expect(err.message).toBeDefined();
		}
	});

	it("permissions config with invalid audit value is rejected", async () => {
		try {
			api = await slothlet({
				...config,
				dir: `${BASE}/callers`,
				permissions: {
					defaultPolicy: "deny",
					audit: "invalid-value",
					rules: []
				}
			});
			expect.unreachable("Should have thrown for invalid audit");
		} catch (err) {
			expect(err.message).toBeDefined();
		}
	});
});
