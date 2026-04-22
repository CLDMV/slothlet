/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-audit-self-bypass.test.vitest.mjs
 *	@Date: 2026-04-14 17:20:22 -07:00 (1776212422)
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

describe.each(getMatrixConfigs())("Permissions > Audit Self Bypass > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("permission:self-bypass lifecycle event emits when module calls itself", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: {
				defaultPolicy: "deny",
				audit: true,
				rules: []
			}
		});

		const bypassEvents = [];
		api.slothlet.lifecycle.on("permission:self-bypass", (data) => {
			bypassEvents.push(data);
		});

		// Self-caller module calls itself internally
		const result = await api.callers.selfCaller.callSelf();
		expect(result).toBeDefined();

		expect(bypassEvents.length).toBeGreaterThan(0);
		expect(bypassEvents[0]).toHaveProperty("caller");
		expect(bypassEvents[0]).toHaveProperty("target");
	});
});
