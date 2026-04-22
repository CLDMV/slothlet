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

	it("removeRule returns true when removing a rule without an owner (public API path)", async () => {
		api = await slothlet({
			...config,
			dir: `${BASE}/payments`,
			permissions: {
				defaultPolicy: "allow"
			}
		});

		// api.slothlet.permissions.addRule always registers with ownerModuleID=null,
		// so the self-modify guard (callerModuleID && ownerModuleID && match) never fires
		// through the public API surface — it requires module-internal rule ownership.
		// This test confirms the happy-path removeRule works correctly.
		const ruleId = api.slothlet.permissions.addRule({
			caller: "untrusted.**",
			target: "payments.**",
			effect: "deny"
		});

		const result = api.slothlet.permissions.removeRule(ruleId);
		expect(result).toBe(true);
	});
});
