/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-control-deny-default.test.vitest.mjs
 *	@Date: 2026-04-14 17:15:46 -07:00 (1776212146)
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
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > Control Deny Default > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("built-in deny rule on slothlet.permissions.control.** blocks enable/disable by default", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// The built-in deny rule should exist for control.**
		const rules = api.slothlet.permissions.global.rulesForPath("slothlet.permissions.control.enable");
		const builtinDeny = rules.find((r) => r.caller === "**" && r.effect === "deny" && r.target === "slothlet.permissions.control.**");
		expect(builtinDeny).toBeDefined();
	});

	it("built-in deny blocks inter-module call to control.enable() even when permissions are globally disabled", async () => {
		// permissions.enabled: false means checkAccess() normally short-circuits to true,
		// but control.** is carved out — the built-in deny still fires for callerWrapper calls.
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: { defaultPolicy: "allow", enabled: false }
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.controlCaller.callEnable();
				expect.unreachable("Should have thrown PERMISSION_DENIED");
			} catch (err) {
				expect(err.message).toContain("PERMISSION_DENIED");
			}
		});
	});

	it("explicit allow rule for control.** permits inter-module enable() even when system is disabled", async () => {
		// An allow rule with exact caller match scores higher specificity than the built-in
		// deny (exact=3 > multi-glob=1), so it wins and the call goes through.
		api = await slothlet({
			...config,
			dir: `${BASE}/callers`,
			permissions: {
				defaultPolicy: "allow",
				enabled: false,
				rules: [{ caller: "controlCaller.*", target: "slothlet.permissions.control.**", effect: "allow" }]
			}
		});

		// Must not throw — explicit allow wins over built-in deny
		await api.controlCaller.callEnable();
	});
});
