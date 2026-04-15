/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-error-self-modify.test.vitest.mjs
 *	@Date: 2026-04-14 17:19:49 -07:00 (1776212389)
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

describe.each(getMatrixConfigs())("Permissions > Error Self Modify > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("PERMISSION_SELF_MODIFY thrown when module adds rule targeting itself", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: []
			}
		});

		await api.slothlet.api.add("payments", `${BASE}/payments`);
		await api.slothlet.api.add("callers", `${BASE}/callers`);

		// Adding a rule where caller === target path prefix should throw self-modify
		try {
			api.slothlet.permissions.addRule({
				caller: "callers.selfCaller",
				target: "callers.selfCaller",
				effect: "allow"
			});
		} catch (err) {
			expect(err.message).toContain("PERMISSION_SELF_MODIFY");
		}
	});
});
