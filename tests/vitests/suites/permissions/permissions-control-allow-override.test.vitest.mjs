/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-control-allow-override.test.vitest.mjs
 *	@Date: 2026-04-14 17:15:56 -07:00 (1776212156)
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

describe.each(getMatrixConfigs())("Permissions > Control Allow Override > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("explicit allow rule for trusted module grants access to control", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "slothlet.permissions.control.**", effect: "allow" }]
			}
		});

		// The allow rule has higher specificity or later registration than built-in deny
		// control.enable/disable should be callable
		api.slothlet.permissions.control.disable();
		api.slothlet.permissions.control.enable();
	});

	it("explicit allow rule permits inter-module control.enable() via self.* (callerWrapper path)", async () => {
		// Exact-match allow rule (specificity 3) beats built-in deny (specificity 1).
		// This test exercises the callerWrapper enforcement path in the control functions.
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "controlCaller.*", target: "slothlet.permissions.control.**", effect: "allow" }]
			}
		});

		// controlCaller.callEnable uses self.* — an inter-module call that has callerWrapper context
		await api.controlCaller.callEnable();
	});
});
