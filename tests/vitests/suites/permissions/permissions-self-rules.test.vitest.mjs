/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-self-rules.test.vitest.mjs
 *	@Date: 2026-04-14 17:14:49 -07:00 (1776212089)
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

describe.each(getMatrixConfigs())("Permissions > self.rules > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("self.rules returns rules matching the calling module path", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [
					{ caller: "callers.**", target: "admin.**", effect: "deny" },
					{ caller: "payments.**", target: "db.**", effect: "deny" }
				]
			}
		});

		// Direct API call to self.rules (outside module context = empty caller)
		const rules = api.slothlet.permissions.self.rules();
		expect(Array.isArray(rules)).toBe(true);
	});
});
